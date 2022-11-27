import {
  dirname,
  join,
  parse,
  relative,
} from "https://deno.land/std@0.165.0/path/posix.ts";
import { walkSync } from "https://deno.land/std@0.165.0/fs/walk.ts";
import { existsSync } from "https://deno.land/std@0.165.0/node/fs.ts";

import MarkdownIt from "npm:markdown-it";
import task_list from "npm:markdown-it-task-lists";
import mathjax from "npm:markdown-it-mathjax3";

import double_link from "./double_link.ts";
import tag_plugin from "./tag.ts";
import callout_box from "./callout_box.ts";
import { highlightCode } from "./highlight.ts";
import { Token } from "./ParseState.ts";

type Optional<T> = T | null;

type VaultOptions = {
  attachmentFolderPath: string | undefined;
  rootUrl: string | undefined;
  graphOnEachPage: boolean;
};
export class Vault {
  notes: Array<Note> = [];
  path: string;
  rootUrl: string;
  assetPath: string;
  files: Array<string>;
  renderer: MarkdownIt;
  tags: Record<string, Set<Note>> = {};
  renderGraphOnEachPage = true;

  constructor(
    path: string,
    { attachmentFolderPath, rootUrl, graphOnEachPage } = {
      attachmentFolderPath: undefined,
      rootUrl: undefined,
      graphOnEachPage: true,
    }
  ) {
    this.path = path;
    this.rootUrl = rootUrl ?? "/";
    this.renderGraphOnEachPage = graphOnEachPage;

    if (!attachmentFolderPath) {
      const obsConfig = JSON.parse(
        Deno.readTextFileSync(join(this.path, ".obsidian", "app.json"))
      );
      this.assetPath = obsConfig.attachmentFolderPath;
    } else {
      this.assetPath = attachmentFolderPath;
    }

    this.files = [];
    this.exploreDir("/");

    this.renderer = new MarkdownIt({
      linkify: true,
      breaks: true,
      highlight: highlightCode,
      html: true,
    })
      .enable("linkify")
      // .use(katex)
      .use(mathjax)
      .use(task_list)
      .use(double_link)
      .use(tag_plugin)
      .use(callout_box);

    this.renderer.renderer.rules.image = (
      tokens: Array<any>,
      idx: number,
      options: any,
      env: ParseEnv,
      self: MarkdownIt
    ): string => {
      const token = tokens[idx];
      const rawSrc: string | null = token.attrGet("src");

      if (rawSrc === null) throw new Error("img with no src attribute");

      const src = decodeURIComponent(rawSrc);
      if (
        !src.startsWith("http://") &&
        !src.startsWith("https://") &&
        !src.startsWith("/")
      ) {
        const newSrc = env.findAsset(src);
        token.attrSet("src", newSrc);
      }

      return self.renderToken(tokens, idx, options);
    };

    const proxy = (
      tokens: Array<Token>,
      idx: number,
      options: any,
      env: ParseEnv,
      self: MarkdownIt
    ) => self.renderToken(tokens, idx, options);
    const headerDefault = this.renderer.renderer.rules.heading_open || proxy;
    this.renderer.renderer.rules.heading_open = (
      tokens: Array<Token>,
      idx: number,
      options: any,
      env: ParseEnv,
      self: MarkdownIt
    ): string => {
      const token = tokens[idx];
      if (token.tag === "h1") {
        env.hasTitle = true;
      }
      return headerDefault(tokens, idx, options, env, self);
    };

    const linkDefault = this.renderer.renderer.rules.link_open || proxy;
    this.renderer.renderer.rules.link_open = (
      tokens: Array<Token>,
      idx: number,
      options: any,
      env: ParseEnv,
      self: MarkdownIt
    ) => {
      const token = tokens[idx];
      const href = token.attrGet("href");

      if (href && href.startsWith("http")) {
        token.attrJoin("target", "_blank");
      }

      return linkDefault(tokens, idx, options, env, self);
    };

    this.renderer.renderer.rules.callout_title = (
      tokens: Array<any>,
      idx: number,
      options: Record<never, never>,
      env: ParseEnv,
      self: MarkdownIt
    ): string => {
      const token = tokens[idx];
      const type = token.content;
      const typeTitle = type[0].toUpperCase() + type.slice(1);
      return `<p div="callout-${type}">${typeTitle}</p>`;
    };
  }

  findNoteByName(name: string): Note | undefined {
    return this.notes.find(
      (note) => note.name().toLowerCase() === name.toLowerCase()
    );
  }

  findNoteByPath(path: string): Note | undefined {
    return this.notes.find((note) => note.path == path);
  }

  addTagRef(tag: string, note: Note) {
    if (tag in this.tags) {
      this.tags[tag].add(note);
    } else {
      this.tags[tag] = new Set([note]);
    }
  }

  exploreDir(path: string) {
    const currentPath = join(this.path, path);
    for (const file of walkSync(currentPath, {
      exts: ["md"],
    })) {
      if (file.isFile && file.name.endsWith(".md")) {
        const filePath = "/" + relative(currentPath, file.path);
        this.files.push(filePath);
        this.notes.push(new Note(filePath, this));
      } else if (file.isDirectory && !(path === "/" && file.name === ".git")) {
        // this.exploreDir(join(path, file.name));
      }
    }
  }
}

export class Note {
  path: string; // Path relative the vault's root (vault.path)
  vault: Vault;
  tags: Array<string> = [];
  backlinks: Set<Note> = new Set();

  hasTitle = false;
  private cached_content: Optional<string> = null;

  textContent(): string {
    const fileContent = Deno.readTextFileSync(this.absPath());
    const env = new ParseEnv(this, this.vault);
    const tokens: Array<Token> = this.vault.renderer.parse(fileContent, env);

    const content: Array<string> = [];
    const explore = (token: Token) => {
      if (token.type === "text") content.push(token.content);
      else if (Array.isArray(token.children)) {
        for (const child of token.children) {
          explore(child);
        }
      }
    };

    for (const token of tokens) {
      explore(token);
    }

    return content.join("\n");
  }

  render(): string {
    if (this.cached_content !== null) {
      return this.cached_content;
    }

    const fileContent = Deno.readTextFileSync(this.absPath());
    const env = new ParseEnv(this, this.vault);
    const output = this.vault.renderer.render(fileContent, env);
    this.hasTitle = env.hasTitle;
    return output;
  }

  absPath(): string {
    return join(this.vault.path, this.path);
  }

  url(): string {
    return join("/", this.vault.rootUrl, this.path.replace(".md", ".html"));
  }

  name(): string {
    return parse(this.path).name;
  }

  constructor(path: string, vault: Vault) {
    this.path = path;
    this.vault = vault;
  }
}

export class ParseEnv {
  hasTitle: boolean = false;

  constructor(private currentNote: Note, public vault: Vault) {}

  addTag(tag: string) {
    this.currentNote.tags.push(tag);
    this.vault.addTagRef(tag, this.currentNote);
  }

  findAsset(name: string): string {
    const noteDir = dirname(this.currentNote.absPath());
    const absPath = join(noteDir, name);

    if (existsSync(absPath)) {
      return join("/", this.vault.rootUrl, relative(this.vault.path, absPath));
    }

    const assetPath = join(this.vault.path, this.vault.assetPath, name);
    if (existsSync(assetPath)) {
      return join(
        "/",
        this.vault.rootUrl,
        relative(this.vault.path, assetPath)
      );
    }

    return join("/", this.vault.rootUrl, name);
  }

  addReference(note: Note) {
    note.backlinks.add(this.currentNote);
  }
}
