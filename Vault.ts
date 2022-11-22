import MarkdownIt from "npm:markdown-it";
import {
  dirname,
  join,
  parse,
  relative,
} from "https://deno.land/std@0.165.0/path/posix.ts";

import task_list from "npm:markdown-it-task-lists";
import mathjax from "npm:markdown-it-mathjax3";
import double_link from "./double_link.ts";
import tag_plugin from "./tag.ts";
import callout_box from "./callout_box.ts";
import { walkSync } from "https://deno.land/std@0.165.0/fs/walk.ts";
import { exists } from "https://deno.land/std@0.165.0/fs/exists.ts";
import { existsSync } from "https://deno.land/std@0.165.0/node/fs.ts";

export class Vault {
  notes: Array<Note> = [];
  path: string;
  assetPath: string;
  files: Array<string>;
  renderer: MarkdownIt;
  tags: Record<string, Set<Note>> = {};

  constructor(path: string) {
    this.path = path;
    this.assetPath = "Images";

    this.files = [];
    this.exploreDir("/");

    this.renderer = new MarkdownIt({
      linkify: true,
      breaks: true,
    })
      .enable("linkify")
      // .use(katex)
      .use(mathjax)
      .use(task_list)
      .use(double_link)
      .use(tag_plugin)
      .use(callout_box);

    /*
    const proxy = (tokens, idx, options, env, self) =>
      self.renderToken(tokens, idx, options);
    const defaultRenderBlockQuoteOpen =
      this.renderer.renderer.rules.blockquote_open || proxy;
    this.renderer.renderer.rules.blockquote_open = (

      tokens: Array<any>,
      idx: number,
      options: Record<never, never>,
      env: ParseEnv,
      self: MarkdownIt
    ) => {
      const token = tokens[idx]
      const calloutType = tokens
      if (calloutType != )
    }*/

    this.renderer.renderer.rules.callout_title = (
      tokens: Array<any>,
      idx: number,
      options: Record<never, never>,
      env: ParseEnv,
      self: MarkdownIt
    ) => {
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

  findAssetByName() {}

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
  backlinks: Array<Note> = [];

  render(): string {
    const fileContent = Deno.readTextFileSync(this.absPath());
    const env = new ParseEnv(this, this.vault);
    const output = this.vault.renderer.render(fileContent, env);
    return output;
  }

  absPath(): string {
    return join(this.vault.path, this.path);
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
  constructor(private currentNote: Note, public vault: Vault) {}

  addTag(tag: string) {
    this.currentNote.tags.push(tag);
    this.vault.addTagRef(tag, this.currentNote);
  }

  findAsset(name: string): string {
    const noteDir = dirname(this.currentNote.absPath());
    const absPath = join(noteDir, name);

    if (existsSync(absPath)) {
      return "/" + relative(this.vault.path, absPath);
    }

    const assetPath = join(this.vault.path, this.vault.assetPath, name);
    if (existsSync(assetPath)) {
      return "/" + relative(this.vault.path, assetPath);
    }
    console.log(assetPath, absPath);

    return name;
  }

  addReference(note: Note) {
    this.currentNote.backlinks.push(note);
  }
}
