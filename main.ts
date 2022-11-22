import { serve } from "https://deno.land/std@0.165.0/http/server.ts";
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
import ProgressBar from "https://deno.land/x/progress@v1.3.4/mod.ts";

import { Vault } from "./Vault.ts";
import { render, renderIndexPage, renderNotesList } from "./template.tsx";
import { generateCss } from "./tailwind.ts";

const exportVault = async (vault: Vault, dest: string) => {
  // const total = vault.notes.length + 2;
  // const progress = new ProgressBar({
  //   title: "Export",
  //   total,
  // });
  let completed = 0;
  if (await exists(dest)) {
    console.log(`Removing ${dest}...`);
    await rmdir(dest, {
      recursive: true,
    });
  }
  await ensureDir(dest);

  const __dirname = dirname(fromFileUrl(import.meta.url));
  await copy(join(__dirname, "style.css"), join(dest, "style.css"));
  // progress.render(completed++);

  const indexFile = join(dest, "index.html");
  await ensureFile(indexFile);
  await Deno.writeTextFile(indexFile, renderIndexPage(vault));
  // progress.render(completed++);

  for await (const entry of walk(vault.path, {
    skip: [/.git.*/, /.obsidian/],
  })) {
    const relPath = relative(vault.path, entry.path);
    const targetPath = join(dest, relPath);

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
        const htmlContent = render(
          entry.name.replace(".md", ""),
          note.render()
        );

        const targetHtmlFile = targetPath.replace(".md", ".html");
        await ensureFile(targetHtmlFile);
        await Deno.writeTextFile(targetHtmlFile, htmlContent);

        //   progress.render(completed++);
      } else if (entry.name !== ".gitignore") {
        await copy(entry.path, targetPath, { overwrite: true });
      }
    }
  }

  const tagsDir = join(dest, "tags");
  await ensureDir(dest);
  for (const [tag, notes] of Object.entries(vault.tags)) {
    const tagDir = join(tagsDir, tag);
    await ensureDir(tagDir);
    const tagFile = join(tagDir, "index.html");
    await ensureFile(tagFile);
    await Deno.writeTextFile(tagFile, renderNotesList([...notes]));
  }

  // progress.render(total);
};

const httpServer = async (vault: Vault) => {
  const isResourceFilePath = (path: string): boolean => {
    const extensions = [".pdf", ".png", ".jpeg", ".jpg"];
    return extensions.find((ext) => path.endsWith(ext)) !== undefined;
  };

  const handler = async (request: Request) => {
    let path = decodeURIComponent(
      request.url.replace("http://localhost:8080", "")
    );

    if (path === "/index.css" || path === "/style.css") {
      const css = Deno.readFileSync(`.${path}`);
      return new Response(css);
    }

    if (isResourceFilePath(path)) {
      let absPath = join(vault.path, path);
      if (!(await exists(absPath))) {
        const components = path.split("/");
        absPath = join(
          vault.path,
          "papers/Images/",
          components[components.length - 1]
        );
      }

      if (!(await exists(absPath))) {
        return new Response("not found", { status: 404 });
      }

      const body = await Deno.readFile(absPath);
      return new Response(body, { status: 200 });
    }

    if (path === "/") {
      const content = renderIndexPage(vault);
      return new Response(content, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (!path.endsWith(".md")) path = path + ".md";

    const note = vault.findNoteByPath(path);
    if (note === undefined) return new Response("not found", { status: 404 });
    const note_content = note.render();

    return new Response(render(note.name(), note_content), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };

  await serve(handler, { port: 8080 });
};

// Start of main code

let cmd = "serve";
if (Deno.args.length >= 2) {
  cmd = Deno.args[1];
}

if (!["serve", "export"].includes(cmd)) {
  throw new Error(`invalid command '${cmd}'`);
}

if (Deno.args.length < 3) {
  throw new Error("unspecified vault path");
}

const options = flags.parse(Deno.args.slice(3), {
  string: ["output", "attachment-folder-path"],
  negatable: ["css"],
});

const vaultPath = normalize(Deno.args[2]);
console.log(`Loading vault at '${vaultPath}'`);

const vault = new Vault(vaultPath, options["attachment-folder-path"]);
console.log("Found", vault.notes.length, "notes");

if (options.css) {
  await generateCss();
}

switch (cmd) {
  case "export": {
    const dest = options.output ?? "./public";
    await exportVault(vault, dest);
    break;
  }
  case "serve":
    await httpServer(vault);
    break;
}
