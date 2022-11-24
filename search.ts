import lunr from "npm:lunr";
import { Vault } from "./Vault.ts";

export const buildIndex = async (vault: Vault, destFile: string) => {
  const index = lunr(function () {
    this.ref("name");
    this.field("text");
    this.field("url");

    vault.notes.forEach((note) => {
      this.add({
        name: note.name(),
        url: note.url(),
        text: note.textContent(),
      });
    });
  });

  await Deno.writeTextFile(destFile, JSON.stringify(index));
};
