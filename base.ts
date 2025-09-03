// Obsidian Base support

import {
  basename,
  extname,
  join,
  relative,
} from "https://deno.land/std@0.165.0/path/mod.ts";
import { Note, Vault } from "./Vault.ts";
import { evaluate, parse } from "./formula.ts";
import { parse as parseYaml } from "https://deno.land/std@0.194.0/yaml/mod.ts";

export type Item = { [key: string]: any };

export type View = {
  type: "table" | "cards";
  name: string;

  order: string[];
  sort: { property: string; direction: "ASC" | "DESC" }[];

  columnSize?: { [prop: string]: number };

  image?: string;
  imageAspectRatio?: number;
};

export type PropertyDescription = {
  displayName?: string;
};

export type BaseDefinition = {
  filters?: { and?: string[]; or?: string };
  properties?: { [name: string]: PropertyDescription };
  formulas?: { [name: string]: string };
  views?: View[];
};

export const defaultEvaluationEnv = (): { [variable: string]: any } => ({
  image: (src: string) => ({ type: "image", src }),
  "if": (cond: boolean, a: any, b: any) => {
    return cond ? a : b;
  },
});

export class Base {
  path: string;
  name: string;
  vault: Vault;
  definition: BaseDefinition;
  notes: Note[];

  constructor(vault: Vault, path: string) {
    this.path = path;
    this.name = basename(path);
    this.name = this.name.slice(
      0,
      this.name.length - extname(this.name).length,
    );
    this.vault = vault;
    const content = Deno.readTextFileSync(path);
    const yaml = parseYaml(content, {}) as BaseDefinition;
    this.definition = yaml;

    const env = defaultEvaluationEnv();
    this.notes = vault.notes.filter(
      (note) => {
        const file = File.fromNote(note);
        env.file = file;

        return this.definition.filters == undefined ||
          this.definition.filters.and?.reduce(
            (c, f) => {
              const e = parse(f);
              return c && evaluate(e, env);
            },
            true,
          );
      },
    );

    if (!this.definition.views) return;
  }

  getViewURL(view: View): string {
    return join(
      "/",
      this.vault.rootUrl,
      relative(this.vault.path, this.path),
      view.name + ".html",
    );
  }

  getViewItems(view: View): Item[] {
    if (view.sort) {
      this.notes.sort((a, b) => {
        // negative indicates a should come before b
        // positive indicates a should come after b
        // 0 or NaN indicates a and b are considered equals
        for (const { property, direction } of view.sort) {
          const ap = a.properties[property];
          const bp = b.properties[property];

          if (ap == bp) continue;

          if (ap > bp) return direction == "ASC" ? 1 : -1;
          return direction == "ASC" ? -1 : 1;
        }

        return 0;
      });
    }

    const env = defaultEvaluationEnv();
    const items = this.notes.map(
      (n) => {
        const item: Item = {};
        const file = File.fromNote(n);
        for (const prop of view.order) {
          let value: any;
          if (prop.startsWith("formula.")) {
            const formName = prop.slice("formula.".length);
            if (!this.definition.formulas) continue;
            const form = this.definition.formulas[formName];
            const expr = parse(form);
            env.file = file;
            const res = evaluate(expr, env);
            value = res;
          } else {
            const env = {
              ...defaultEvaluationEnv(),
              ...n.properties,
              file: File.fromNote(n),
            };
            value = evaluate(parse(prop), env);
          }

          item[prop] = value;
        }

        const formula: { [key: string]: any } = {};
        if (this.definition.formulas) {
          for (
            const [name, form] of Object.entries(this.definition.formulas)
          ) {
            const env = {
              ...defaultEvaluationEnv(),
              ...n.properties,
              file: File.fromNote(n),
            };
            const expr = parse(form);
            formula[name] = evaluate(expr, env);
          }
        }
        item.formula = formula;

        return item;
      },
    );

    return items;
  }

  displayName(prop: string): string {
    if (
      !this.definition.properties ||
      !this.definition.properties[prop]
    ) return prop;

    return this.definition?.properties[prop]?.displayName ?? prop;
  }
}

type Link = { type: "link"; href: string; text: string };

export class File {
  private vault: Vault;

  backlinks: string[] = [];
  embeds: string[] = [];
  ext: string;
  folder: string;
  links: string[] = [];
  name: Link;
  basename: Link;
  path: string;
  properties: { [key: string]: any } = {};
  tags: string[] = [];

  inFolder(folder: string): boolean {
    return this.path.includes(`/${folder}/`);
  }

  static emptyFile() {}

  __call(path: string) {
    path = path.trim();
    if (path.startsWith("[[")) path = path.slice(2);
    if (path.endsWith("]]")) path = path.slice(0, path.length - 2);

    const note = this.vault.findNoteByName(path);
    if (!note) return new File(this.vault, path);

    return File.fromNote(note);
  }

  static fromNote(note: Note) {
    const file = new File(note.vault, note.path);

    note.render();

    file.properties = note.properties;
    file.tags = note.tags;
    file.links = Array.from(note.forwardLinks.keys().map((n) => n.path));
    file.embeds = note.embeds;

    return file;
  }

  constructor(vault: Vault, path: string) {
    this.vault = vault;

    const segments = path.split("/");
    const fullname = segments[segments.length - 1];
    const s = fullname.split(".");

    this.ext = s.length > 1 ? s[s.length - 1] : "";
    const href = vault.findNoteByPath(path)?.url() ?? path;
    const withoutExt = (name: string) => {
      const ext = extname(name);
      return name.slice(0, name.length - ext.length);
    };
    this.name = {
      type: "link",
      href,
      text: withoutExt(s.length > 1 ? s[s.length - 2] : fullname),
    };
    this.basename = {
      type: "link",
      href,
      text: withoutExt(basename(path)),
    };
    this.folder = segments.slice(0, segments.length - 1).join("/");
    this.path = path;
  }
}
