import { serve } from "https://deno.land/std@0.165.0/http/server.ts";
import { serveDir } from "https://deno.land/std@0.165.0/http/file_server.ts";
import {
  dirname,
  join,
  relative,
  normalize,
  fromFileUrl,
} from "https://deno.land/std@0.165.0/path/posix.ts";
import {
  copy,
  ensureDir,
  ensureFile,
  exists,
  walk,
} from "https://deno.land/std@0.165.0/fs/mod.ts";
import { rmdir } from "https://deno.land/std@0.165.0/node/fs/promises.ts";
import * as flags from "https://deno.land/std@0.165.0/flags/mod.ts";

import { Vault } from "./Vault.ts";
import {
  render,
  renderGraphPage,
  renderIndexPage,
  renderNotesList,
  searchPage,
} from "./template.tsx";
import { generateCss } from "./tailwind.ts";
import { buildIndex } from "./search.ts";

const exportVault = async (vault: Vault, dest: string) => {
  dest = normalize(dest);
  const miscPath = join(dest, "obsidian");

  if (await exists(dest)) {
    console.log(`Removing ${dest}...`);
    await rmdir(dest, {
      recursive: true,
    });
  }
  await ensureDir(dest);

  const __dirname = dirname(fromFileUrl(import.meta.url));
  await copy(join(__dirname, "style.css"), join(dest, "style.css"));

  const indexFile = join(dest, "index.html");
  await ensureFile(indexFile);
  await Deno.writeTextFile(indexFile, renderIndexPage(vault));

  for await (const entry of walk(vault.path, {
    skip: [/.git.*/, /.obsidian/],
  })) {
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
      } else if (entry.name !== ".gitignore") {
        await copy(entry.path, targetPath, { overwrite: true });
      }
    }
  }

  const tagsDir = join(miscPath, "tags");
  await ensureDir(miscPath);
  for (const [tag, notes] of Object.entries(vault.tags)) {
    const tagDir = join(tagsDir, tag);
    await ensureDir(tagDir);
    const tagFile = join(tagDir, "index.html");
    await ensureFile(tagFile);
    await Deno.writeTextFile(
      tagFile,
      renderNotesList(`#${tag}`, [...notes], vault.rootUrl, true)
    );
  }

  const searchDir = join(miscPath, "search");
  await ensureDir(searchDir);
  await buildIndex(vault, join(searchDir, "lunr_search_index.json"));
  await copy(join(__dirname, "search.js"), join(searchDir, "search.js"));
  await Deno.writeTextFile(
    join(searchDir, "index.html"),
    searchPage(vault.rootUrl)
  );

  const graphDir = join(miscPath, "graph");
  await ensureDir(graphDir);
  const noteIds: Record<string, number> = {};
  const nodes = vault.notes.map((note, i) => {
    noteIds[note.absPath()] = i;
    return {
      id: i,
      url: note.url(),
      name: note.name(),
    };
  });
  const links = vault.notes.flatMap((note) =>
    [...note.backlinks].map((link) => ({
      source: noteIds[note.absPath()],
      target: noteIds[link.absPath()],
    }))
  );
  const graph = { nodes, links };
  await Promise.all([
    Deno.writeTextFile(join(graphDir, "graph.json"), JSON.stringify(graph)),
    Deno.writeTextFile(join(graphDir, "index.html"), renderGraphPage(vault)),
    copy(join(__dirname, "graph.js"), join(graphDir, "graph.js")),
  ]);

  console.log("Done!");
};

const httpServer = async (rootUrl: string, dest: string) => {
  if (rootUrl.endsWith("/")) rootUrl = rootUrl.slice(0, rootUrl.length - 1);
  console.log("rootUrl", rootUrl);
  await serve(
    (req) => {
      return serveDir(req, { urlRoot: rootUrl, fsRoot: dest });
    },
    {
      port: 8080,
    }
  );
};

// Start of main code

let cmd = "serve";
if (Deno.args.length >= 1) {
  cmd = Deno.args[0];
}

const COMMANDS = ["serve", "export", "generate-css"];

if (!COMMANDS.includes(cmd)) {
  throw new Error(`invalid command '${cmd}'`);
}

const options = flags.parse(Deno.args.slice(2), {
  string: ["output", "attachment-folder-path", "root-url"],
  negatable: ["css"],
  boolean: ["no-graph-on-each-page"],
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
