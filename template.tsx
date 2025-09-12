import { basename, join, relative } from "@std/path";
import ReactDOMServer from "https://jspm.dev/react-dom@16.14.0/server";
import React from "https://jspm.dev/react@16.14.0";
import { default as titleCase } from "https://deno.land/x/case@2.2.0/titleCase.ts";
import { slugify } from "https://deno.land/x/slugify@0.3.0/mod.ts";

import { Note, ParseEnv, Vault } from "./Vault.ts";
import { Base, defaultEvaluationEnv, File, Item, View } from "./base.ts";
import { evaluate, parse } from "./formula.ts";

function renderToStaticMarkupWithDoctype(el): string {
  const markup = ReactDOMServer.renderToStaticMarkup(el);
  return `<!doctype html>
    ${markup}`;
}

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
      <div className="ml-3">{entries}</div>
    </details>
  );
};

const prettyTitle = (vault: Vault, title: string) =>
  vault.title === undefined ? title : title.length === 0
    ? (
      vault.title
    )
    : (
      <>
        {title} &middot; {vault.title}
      </>
    );

const template = (name: string, content: any, rootUrl = "/") => {
  return (
    <html>
      <head>
        <link rel="stylesheet" href={join("/", rootUrl, "style.css")} />
        <meta charSet="utf-8"></meta>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="shortcut icon" href={join("/", rootUrl, "favicon.ico")} />
        <link rel="preconnect" href="https://rsms.me/"></link>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css"></link>
        <title>{name}</title>
      </head>
      <body className="dark:bg-zinc-700 dark:text-zinc-100">
        <meta content="#fff" name="theme-color"></meta>
        <div className="">
          <nav className="print:hidden mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl mb-5 py-2 border-b border-zinc-200 flex justify-between">
            <div className="flex">
              <a
                className="hover:text-gray-900 text-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
                href={join("/", rootUrl)}
              >
                Home
              </a>
              <a
                className="ml-4 hover:text-gray-900 text-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
                href={join("/", rootUrl, "obsidian", "tags")}
              >
                Tags
              </a>
              <a
                className="ml-4 flex hover:text-gray-900 text-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
                href={join("/", rootUrl, "obsidian", "search")}
              >
                Search
              </a>
            </div>
            <div
              dangerouslySetInnerHTML={{
                __html: `
            <button onclick="toggleTheme()" class="focus:border-none h-6 w-6 mr-1">
              <p id="bedrockThemeSelector">🌝</p>
            </button>
            `,
              }}
            >
            </div>
          </nav>

          {/* <main className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl max-w-none flex"> */}
          {
            /* <aside className="max-w-sm overflow-x-clip">
              <TreeView path="/home/paul/notes" absPath="/home/paul/notes" />
            </aside> */
          }

          <main className="mx-4 md:mx-auto md:max-w-xl xl:max-w-3xl">
            {content}
          </main>

          {/* </main> */}
        </div>
      </body>
      <script src={join("/", rootUrl, "obsidian", "theme.js")}></script>
    </html>
  );
};

export const renderBase = (base: Base, view: View): string => {
  if (
    !base.definition.views ||
    base.definition.views.length == 0
  ) throw new Error("invalid");

  const renderOrder = (order: string, it: Item, note: Note) => {
    const env = {
      file: File.fromNote(note),
      ...defaultEvaluationEnv(),
      ...it,
    };

    const expr = parse(order);
    const value = evaluate(expr, env);

    return renderProperties(
      note,
      value,
      false,
    );
  };

  const items = base.getViewItems(view);

  let content;
  if (view.type == "table") {
    content = (
      <table className="prose-img:m-0 prose-img:h-12">
        <thead>
          {view.order.map((o) => <td key={o}>{base.displayName(o)}</td>)}
        </thead>
        <tbody>
          {items.map(
            (it, i) => (
              <tr key={i}>
                {view.order.map((o) => (
                  <td key={o}>
                    {renderOrder(o, it, base.notes[i])}
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    );
  } else if (view.type == "cards") {
    content = (
      <div className="grid grid-cols-3 gap-4">
        {items.map(
          (it, i) => (
            <div
              key={i}
              className="border rounded-lg shadow-md prose-img:rounded-none prose-img:m-0"
            >
              <div
                className="w-full bg-cover bg-center rounded-t-lg"
                style={{
                  aspectRatio: `${1 / view.imageAspectRatio ?? 1}`,
                  backgroundImage: `url('${
                    evaluate(parse(view.image), it).src
                  }')`,
                }}
              >
              </div>
              <div className="p-3 prose-p:m-0 prose-a:no-underline">
                {view.order.map((o, io) => (
                  <div key={o} className="leading-5 mb-2 last:mb-0">
                    {io > 0
                      ? <p className="text-xs text-gray-600">{o}</p>
                      : undefined}
                    {renderOrder(o, it, base.notes[i])}
                  </div>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    );
  } else {
    throw new Error("unknown view type " + view.type);
  }

  return renderToStaticMarkupWithDoctype(
    template(
      <>{base.name} &middot; {prettyTitle(base.vault, view.name)}</>,
      proseStyle(
        <>
          {content}

          <div className="mt-4">
            <label htmlFor="view" className="mr-3">View:</label>
            <select name="view" id="base-view">
              {base.definition.views?.map((v) => (
                <option
                  selected={v.name == view.name}
                  key={v.name}
                  value={base.getViewURL(v)}
                >
                  {v.name}
                </option>
              ))}
            </select>
            <script
              src={join("/", base.vault.rootUrl, "obsidian", "baseView.js")}
            />
          </div>
        </>,
      ),
      base.vault.rootUrl,
    ),
  );
};

export const searchPage = (vault: Vault) => {
  const rootUrl = vault.rootUrl;
  const content = proseStyle(
    <>
      <input
        className="mt-1 px-2 block w-full not-prose rounded-md border border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 dark:text-zinc-100 dark:bg-zinc-800"
        type="text"
        autoFocus
        placeholder="Search..."
      />

      <ul className="results-area"></ul>

      <script src="https://unpkg.com/lunr/lunr.js"></script>
      <script src={join("/", rootUrl, "obsidian", "search", "search.js")} />
    </>,
  );

  return renderToStaticMarkupWithDoctype(
    template(prettyTitle(vault, "Search"), content, rootUrl),
  );
};

const proseStyle = (component: any) => (
  <div className="max-w-none prose prose-zinc prose-img:rounded dark:prose-invert mb-5 prose-h2:mt-4 prose-h3:mt-3">
    {component}
  </div>
);

export const renderLinksList = (
  vault: Vault,
  title: string,
  links: Array<{ name: string; url: string }>,
): string => {
  const list = proseStyle(
    <>
      <h1>{title}</h1>
      <ul>
        {links.map((link, id) => (
          <li key={id}>
            <a href={link.url}>{link.name}</a>
          </li>
        ))}
      </ul>
    </>,
  );
  return renderToStaticMarkupWithDoctype(
    template(prettyTitle(vault, title), list, vault.rootUrl),
  );
};

export const renderNotesList = (
  vault: Vault,
  title: string,
  notes: Array<Note>,
  addTitle: boolean,
  addGraph?: boolean,
): string => {
  const list = proseStyle(
    <>
      {addTitle ? <h1>{title}</h1> : undefined}
      <ul>
        {notes.map((note) => (
          <li key={note.path}>
            <a href={note.url()}>{note.path.replace(".md", "")}</a>
          </li>
        ))}
      </ul>

      {addGraph && vault.renderGraphOnEachPage
        ? graphComponent(vault, title)
        : undefined}
    </>,
  );
  return renderToStaticMarkupWithDoctype(
    template(prettyTitle(vault, title), list, vault.rootUrl),
  );
};

export const renderIndexPage = (vault: Vault): string => {
  return renderNotesList(
    vault,
    vault.title === undefined ? "Vault Home" : "",
    vault.notes,
    false,
  );
};

export const renderGraphPage = (vault: Vault): string => {
  const content = (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href={join("/", vault.rootUrl, "style.css")} />
        <script src="https://cdn.jsdelivr.net/npm/d3@6"></script>
        <script src="https://unpkg.com/force-graph"></script>
      </head>
      <body className="bg-gray-100">
        <div id="graph">
          <script
            type="module"
            src={join("/", vault.rootUrl, "obsidian", "graph", "graph.js")}
          >
          </script>
        </div>
      </body>
    </html>
  );

  return renderToStaticMarkupWithDoctype(content);
};

const formatDate = (d: Date): string =>
  d.getDate().toString().padStart(2, "0") + "/" +
  (d.getMonth() + 1).toString().padStart(2, "0") + "/" +
  d.getFullYear().toString();

const renderProperties = (note: Note, prop: any, tags: boolean) => {
  const vault = note.vault;

  if (tags && typeof prop == "string") {
    const delta = 0 + prop.startsWith("#");
    return (
      <a
        href={join("/", vault.rootUrl, "obsidian", "tags", prop.slice(delta))}
        className="tag"
      >
        {prop}
      </a>
    );
  }

  if (typeof prop === "string") {
    if (prop.startsWith("http://") || prop.startsWith("https://")) {
      return <a target="_blank" href={prop}>{prop}</a>;
    }

    const env = new ParseEnv(note);
    try {
      const content = vault.renderer.renderInline(prop, env);
      return (
        <span
          className="prose-p:m-0"
          dangerouslySetInnerHTML={{ __html: content }}
        >
        </span>
      );
    } catch {
      return <span>{prop}</span>;
    }
  }

  if (Array.isArray(prop)) {
    return prop.map((p, i) => (
      <span key={i} className="mr-2">{renderProperties(note, p, tags)}</span>
    ));
  }

  if (prop instanceof Date) {
    return formatDate(prop);
  }

  if (typeof prop === "boolean") {
    return (
      <input
        type="checkbox"
        style={{ pointerEvents: "none" }}
        checked={prop ? "checked" : ""}
        readOnly
      />
    );
  }

  if (typeof prop === "object" && prop?.type === "link") {
    return (
      <a className="block truncate text-ellipsis" href={prop.href}>
        {prop.text}
      </a>
    );
  }

  if (typeof prop === "object" && prop?.type === "image") {
    return <img src={prop.src}></img>;
  }

  return undefined;
};

export const render = (vault: Vault, title: string, note: Note): string => {
  const renderedContent = note.render();
  const addTitle = !note.hasTjtle;

  const backNotes = [...note.backlinks];
  const content = proseStyle(
    <>
      {addTitle
        ? <h1 id={slugify(note.name(), { lower: true })}>{note.name()}</h1>
        : undefined}
      {note.headings.length > 0
        ? (
          <div id="bedrock-toc">
            ParseEnv
            <p id="bedrock-toc-title" className="">Table of contents</p>
            <hr />
          </div>
        )
        : undefined}
      {Object.keys(note.properties).length > 0
        ? (
          <table className="mb-0">
            <thead>
              <tr>
                <td>Properties</td>
                <td></td>
              </tr>
            </thead>
            <tbody>
              {Object.entries(note.properties).map(([k, v]) => (
                <tr key={k}>
                  <td className="">{titleCase(k)}</td>
                  <td className="">
                    {renderProperties(note, v, k === "tags")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
        : undefined}

      <div dangerouslySetInnerHTML={{ __html: renderedContent }}></div>

      {backNotes.length > 0
        ? (
          <div className="print:hidden">
            <hr />
            <h4>Backlinks</h4>
            <ul>
              {backNotes.map((backNote) => (
                <li key={backNote.path}>
                  <a href={backNote.url()}>{backNote.name()}</a>
                </li>
              ))}
            </ul>
          </div>
        )
        : undefined}
      {vault.renderGraphOnEachPage
        ? graphComponent(vault, note.name())
        : undefined}

      <script src={join("/", vault.rootUrl, "obsidian", "toc.js")} />
    </>,
  );
  return renderToStaticMarkupWithDoctype(
    template(prettyTitle(vault, title), content, vault.rootUrl),
  );
};

const graphComponent = (vault: Vault, name?: string) => (
  <div className="print:hidden">
    <hr />
    <h4>Graph view</h4>
    <iframe
      src={join(
        "/",
        vault.rootUrl,
        "obsidian",
        "graph",
        ...(name !== undefined ? [`?name=${encodeURIComponent(name)}`] : []),
      )}
      frameBorder="0"
      className="w-full rounded-sm border"
    >
    </iframe>
  </div>
);
