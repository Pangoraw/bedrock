import {
  basename,
  join,
  relative,
} from "https://deno.land/std@0.165.0/path/posix.ts";
import ReactDOMServer from "https://jspm.dev/react-dom@16.14.0/server";
import React from "https://jspm.dev/react@16.14.0";

import { Note, Vault } from "./Vault.ts";

const TreeView = ({ path, absPath }: { absPath: string; path: string }) => {
  const gen = Deno.readDirSync(path);
  const entries = [];
  for (const entry of gen) {
    const entryPath = join(path, entry.name);
    if (
      entry.isDirectory &&
      entry.name !== ".git" &&
      entry.name !== ".obsidian"
    ) {
      entries.push(
        <TreeView key={entryPath} path={entryPath} absPath={absPath} />
      );
    } else if (entry.isFile && entry.name !== ".gitignore") {
      entries.push(
        <p key={entry.name}>
          <a href={`/${relative(absPath, entryPath)}`}>
            {entry.name.replace(".md", "")}
          </a>
        </p>
      );
    }
  }

  return (
    <details>
      <summary>{basename(path, "")}</summary>
      <div className="ml-3">{entries}</div>
    </details>
  );
};

const template = (name: string, content: string, rootUrl: string = "/") => {
  return (
    <html>
      <head>
        <link rel="stylesheet" href={"/" + join(rootUrl, "style.css")} />
        <meta charSet="utf-8"></meta>
        <title>{name}</title>
      </head>
      <body className="dark:bg-zinc-800">
        <div className="">
          <nav className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl mb-5 py-2 border-b border-zinc-200 flex">
            <a
              className="flex hover:text-gray-900 text-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
              href={"/" + rootUrl}
            >
              Home
            </a>
          </nav>

          {/* <main className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl max-w-none flex"> */}
          {/* <aside className="max-w-sm overflow-x-clip">
              <TreeView path="/home/paul/notes" absPath="/home/paul/notes" />
            </aside> */}
          <article
            className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl max-w-none prose prose-zinc dark:prose-invert mb-5 prose-h2:mt-4 prose-h3:mt-3"
            dangerouslySetInnerHTML={{ __html: content }}
          ></article>
          {/* </main> */}
        </div>
      </body>
    </html>
  );
};

export const renderNotesList = (
  notes: Array<Note>,
  rootUrl: string
): string => {
  let content = "<ul>";
  for (const note of notes) {
    content += `\n<li><a href="${join(
      "/",
      rootUrl,
      note.path.replace(".md", ".html")
    )}">${note.path.replace(".md", "")}</a></li>`;
  }
  content += "</ul>";
  return ReactDOMServer.renderToString(template("index", content, rootUrl));
};

export const renderIndexPage = (vault: Vault): string => {
  return renderNotesList(vault.notes, vault.rootUrl);
};

export const render = (vault: Vault, title: string, content: string): string =>
  ReactDOMServer.renderToString(template(title, content, vault.rootUrl));
