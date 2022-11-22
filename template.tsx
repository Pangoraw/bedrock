import {
  basename,
  join,
  relative,
} from "https://deno.land/std@0.165.0/path/posix.ts";
import ReactDOMServer from "https://jspm.dev/react-dom@16.14.0/server";
import React from "https://jspm.dev/react@16.14.0";

const TreeView = ({ path, absPath }: { absPath: string; path: string }) => {
  const gen = Deno.readDirSync(path);
  const entries = [];
  for (const entry of gen) {
    const entryPath = join(path, entry.name);
    if (
      entry.isDirectory && entry.name !== ".git" && entry.name !== ".obsidian"
    ) {
      entries.push(
        <TreeView key={entryPath} path={entryPath} absPath={absPath} />,
      );
    } else if (entry.isFile && entry.name !== ".gitignore") {
      entries.push(
        <p key={entry.name}>
          <a href={`/${relative(absPath, entryPath)}`}>
            {entry.name.replace(".md", "")}
          </a>
        </p>,
      );
    }
  }

  return (
    <details>
      <summary>{basename(path, "")}</summary>
      <div className="ml-3">
        {entries}
      </div>
    </details>
  );
};

const template = (name: string, content: string) => {
  return (
    <html>
      <head>
        {/* <link rel="stylesheet" href="/index.css" /> */}
        <link rel="stylesheet" href="/style.css" />
        <title>{name}</title>
      </head>
      <body>
        <div className="">
          <nav className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl mb-5 py-2 border-b border-gray-600 flex">
            <a className="flex hover:text-gray-900 text-gray-800" href="/">
              Home
            </a>
          </nav>

          <main className="flex">
            {
              /* <aside className="max-w-sm overflow-x-clip">
              <TreeView path="/home/paul/notes" absPath="/home/paul/notes" />
            </aside> */
            }
            <article
              className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl max-w-none prose prose-zinc mb-5"
              dangerouslySetInnerHTML={{ __html: content }}
            >
            </article>
          </main>
        </div>
      </body>
    </html>
  );
};

export const render = (title: string, content: string): string =>
  ReactDOMServer.renderToString(template(title, content));
