import lunr from "npm:lunr";
import { Vault } from "./Vault.ts";

export const buildIndex = async (vault: Vault, destFile: string) => {
  const documents = vault.notes.map((note) => ({
    url: note.url(),
    name: note.name(),
  }));
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
