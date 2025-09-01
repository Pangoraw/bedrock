import { serveDir } from "@std/http";
import { dirname, fromFileUrl, join, normalize, relative } from "@std/path";
import { copy, ensureDir, ensureFile, exists, walk } from "@std/fs";
import { removeSync as rmdir } from "@std/fs/unstable-remove";
import * as flags from "@std/flags";

import { Vault } from "./Vault.ts";
import {
  render,
  renderBase,
  renderGraphPage,
  renderIndexPage,
  renderLinksList,
  renderNotesList,
  searchPage,
} from "./template.tsx";
import { generateCss } from "./tailwind.ts";
import { buildIndex } from "./search.ts";
import { Base } from "./base.ts";

const nodeConnectivity = (x: number): number =>
  0.25 * Math.sqrt(Math.max(1, x));

const exportVault = async (vault: Vault, dest: string) => {
  dest = normalize(dest);
  const miscPath = join(dest, "obsidian");

  if (await exists(dest)) {
    console.log(`Removing ${dest}...`);
    rmdir(dest, {
      recursive: true,
    });
  }
  await ensureDir(dest);

  const __dirname = dirname(fromFileUrl(import.meta.url));
  await copy(join(__dirname, "style.css"), join(dest, "style.css"));

  const indexFile = join(dest, "index.html");
  await ensureFile(indexFile);
  await Deno.writeTextFile(indexFile, renderIndexPage(vault));

  // Pre-render notes to get backlinks
  for (const note of vault.notes) {
    note.render();
  }

  for await (
    const entry of walk(vault.path, {
      skip: [/.git.*/, /.obsidian/],
    })
  ) {
    const relPath = relative(vault.path, entry.path);
    const targetPath = join(dest, relPath);

    // Skip files contained in the destination folder itself if it is contained in the vault
    if (normalize(entry.path).startsWith(dest)) {
      continue;
    }

    if (entry.isDirectory) {
      await ensureDir(targetPath);
    } else if (entry.isFile) {
      const containingDir = dirname(entry.path);
      if (!(await exists(containingDir))) await ensureDir(containingDir);

      if (entry.name.endsWith(".md")) {
        const note = vault.findNoteByPath("/" + relPath);
        if (note === undefined) {
          throw new Error(`could not find note ${entry.name} at ${relPath}`);
        }
        const htmlContent = render(vault, entry.name.replace(".md", ""), note);

        const targetHtmlFile = targetPath.replace(".md", ".html");
        await ensureFile(targetHtmlFile);
        await Deno.writeTextFile(targetHtmlFile, htmlContent);
      } else if (entry.name.endsWith(".base")) {
        if (vault.renderBases) {
          vault.basePaths.push(relPath);
        }
      } else if (entry.name !== ".gitignore") {
        await copy(entry.path, targetPath, { overwrite: true });
      }
    }
  }

  for (const basePath of vault.basePaths) {
    const base = new Base(vault, join(vault.path, basePath));

    for (const view of base.definition.views ?? []) {
      const htmlContent = renderBase(base, view);

      const targetHtmlFile = join(dest, basePath, view.name + ".html");
      await ensureFile(targetHtmlFile);
      await Deno.writeTextFile(targetHtmlFile, htmlContent);
    }
  }

  await ensureDir(miscPath);
  const tagsDir = join(miscPath, "tags");
  // await copy(join(__dirname, "toc.js"), join(miscPath, "toc.js"));
  await ensureDir(tagsDir);

  const tagsIndexFile = join(tagsDir, "index.html");
  await Deno.writeTextFile(
    tagsIndexFile,
    renderLinksList(
      vault,
      "Tags",
      Object.keys(vault.tags).map((tag) => ({
        name: `#${tag}`,
        url: join("/", vault.rootUrl, "obsidian", "tags", tag),
      })),
    ),
  );

  for (const [tag, notes] of Object.entries(vault.tags)) {
    const tagDir = join(tagsDir, tag);
    await ensureDir(tagDir);
    const tagFile = join(tagDir, "index.html");
    await ensureFile(tagFile);
    await Deno.writeTextFile(
      tagFile,
      renderNotesList(vault, `#${tag}`, [...notes], true, true),
    );
  }

  const baseViewFile = join(dest, "obsidian", "baseView.js");
  await copy(join(__dirname, "baseView.js"), baseViewFile);

  const searchDir = join(miscPath, "search");
  await ensureDir(searchDir);
  await buildIndex(vault, join(searchDir, "lunr_search_index.json"));
  await copy(join(__dirname, "search.js"), join(searchDir, "search.js"));
  await Deno.writeTextFile(join(searchDir, "index.html"), searchPage(vault));

  const graphDir = join(miscPath, "graph");
  await ensureDir(graphDir);
  const noteIds: Record<string, number> = {};
  let nodes = vault.notes.map((note, i) => {
    noteIds[note.absPath()] = i;
    return {
      id: i,
      url: note.url(),
      name: note.name(),
      tag: note.tags.length > 0 ? note.tags[0] : undefined,
      connectivity: nodeConnectivity(
        note.tags.length + note.backlinks.size + note.forwardLinks.size,
      ),
    };
  });

  const numNodes = nodes.length;
  nodes = nodes.concat(
    Object.keys(vault.tags).map((tag, i) => {
      const tagId = numNodes + i;
      noteIds["__tag#" + tag] = tagId;
      return {
        id: tagId,
        url: join("/", vault.rootUrl, "obsidian", "tags", tag),
        name: "#" + tag,
        tag,
        connectivity: nodeConnectivity(vault.tags[tag].size),
      };
    }),
  );
  let links = vault.notes.flatMap((note) =>
    [...note.backlinks]
      .map((link) => ({
        source: noteIds[note.absPath()],
        target: noteIds[link.absPath()],
      }))
      .concat()
  );
  links = links.concat(
    Object.entries(vault.tags).flatMap(([tag, notes]) =>
      [...notes].map((note) => ({
        source: noteIds["__tag#" + tag],
        target: noteIds[note.absPath()],
      }))
    ),
  );

  const graph = { nodes, links };
  await Promise.all([
    Deno.writeTextFile(join(graphDir, "graph.json"), JSON.stringify(graph)),
    Deno.writeTextFile(join(graphDir, "index.html"), renderGraphPage(vault)),
    copy(join(__dirname, "graph.js"), join(graphDir, "graph.js")),
    copy(join(__dirname, "theme.js"), join(miscPath, "theme.js")),
    copy(join(__dirname, "toc.js"), join(miscPath, "toc.js")),
  ]);

  console.log("Done!");
};

const httpServer = (rootUrl: string, dest: string) => {
  if (rootUrl.endsWith("/")) rootUrl = rootUrl.slice(0, rootUrl.length - 1);
  Deno.serve(
    (req) => {
      return serveDir(req, { urlRoot: rootUrl, fsRoot: dest });
    },
    {
      port: 8080,
    },
  );
};

// Start of main code

let cmd = "serve";
if (Deno.args.length >= 1) {
  cmd = Deno.args[0];
}

addEventListener("error", (event) => {
  console.log(event);
});

const COMMANDS = ["serve", "export", "generate-css"];

if (!COMMANDS.includes(cmd)) {
  throw new Error(`invalid command '${cmd}'`);
}

const options = flags.parse(Deno.args.slice(2), {
  string: ["title", "output", "attachment-folder-path", "root-url"],
  negatable: ["css"],
  boolean: ["no-graph-on-each-page", "no-render-bases"],
});

if (cmd === "generate-css" || options.css) {
  await generateCss();
  options.css || Deno.exit(0);
}

if (Deno.args.length < 2) {
  throw new Error("unspecified vault path");
}

const vaultPath = normalize(Deno.args[1]);
console.log(`Loading vault at '${vaultPath}'`);

const vault = new Vault(vaultPath, {
  attachmentFolderPath: options["attachment-folder-path"],
  rootUrl: options["root-url"],
  graphOnEachPage: !options["no-graph-on-each-page"],
  title: options.title,
  renderBases: !options["no-render-bases"],
});
console.log("Found", vault.notes.length, "notes");

const dest = options.output ?? "./public";
switch (cmd) {
  case "export":
    await exportVault(vault, dest);
    break;
  case "serve":
    await Promise.all([
      exportVault(vault, dest),
      httpServer(vault.rootUrl, dest),
    ]);
    break;
}
