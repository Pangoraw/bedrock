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
import { render, renderIndexPage, renderNotesList } from "./template.tsx";
import { generateCss } from "./tailwind.ts";

const exportVault = async (vault: Vault, dest: string) => {
  dest = normalize(dest);

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
        const htmlContent = render(
          entry.name.replace(".md", ""),
          note.render()
        );

        const targetHtmlFile = targetPath.replace(".md", ".html");
        await ensureFile(targetHtmlFile);
        await Deno.writeTextFile(targetHtmlFile, htmlContent);
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
  console.log("Done!");
};

const httpServer = async (dest: string) => {
  await serve(
    (req) => {
      return serveDir(req, { fsRoot: dest });
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

if (!["serve", "export"].includes(cmd)) {
  throw new Error(`invalid command '${cmd}'`);
}

if (Deno.args.length < 2) {
  throw new Error("unspecified vault path");
}

const options = flags.parse(Deno.args.slice(2), {
  string: ["output", "attachment-folder-path"],
  negatable: ["css"],
});

const vaultPath = normalize(Deno.args[1]);
console.log(`Loading vault at '${vaultPath}'`);

const vault = new Vault(vaultPath, options["attachment-folder-path"]);
console.log("Found", vault.notes.length, "notes");

if (options.css) {
  await generateCss();
}

const dest = options.output ?? "./public";
switch (cmd) {
  case "export":
    await exportVault(vault, dest);
    break;
  case "serve":
    await Promise.all([exportVault(vault, dest), httpServer(dest)]);
    break;
}
