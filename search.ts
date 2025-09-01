import lunr from "npm:lunr";
import { basename, join } from "@std/path";

import { Vault } from "./Vault.ts";
import { Base } from "./base.ts";

export const buildIndex = async (vault: Vault, destFile: string) => {
  const documents = vault.notes.map((note) => ({
    url: note.url(),
    name: note.name(),
  }));

  for (const basePath of vault.basePaths) {
    const base = new Base(vault, join(vault.path, basePath));
    const view = base.definition.views?.length
      ? base.definition.views[0]
      : undefined;
    if (!view) continue;

    const name = basename(basePath);
    documents.push({
      url: base.getViewURL(view),
      name,
    });
  }

  const index = lunr(function () {
    this.ref("url");
    this.field("name");
    // this.field("text");

    documents.forEach((doc) => {
      this.add(doc);
    });
  });

  await Deno.writeTextFile(destFile, JSON.stringify({ index, documents }));
};
