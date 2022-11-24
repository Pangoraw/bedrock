import { env } from "https://deno.land/std@0.165.0/node/process.ts";
import { join } from "https://deno.land/std@0.165.0/path/win32.ts";
import { MarkdownIt, ParseInlineState } from "./ParseState.ts";
import { ParseEnv } from "./Vault.ts";

function isNumeric(code: number): boolean {
  return code >= 0x30 /* 0 */ && code <= 0x39 /* 9 */;
}

function isAlpha(code: number): boolean {
  return (
    (code >= 0x61 /* a */ && code <= 0x7a) /* z */ ||
    (code >= 0x41 /* A */ && code <= 0x5a) /* Z */
  );
}

export default function tag_plugin(md: MarkdownIt, _opts: any) {
  md.inline.ruler.after(
    "link",
    "tag",
    function double_link(state: ParseInlineState<ParseEnv>, silent: boolean) {
      let pos = state.pos;

      if (state.src.charCodeAt(pos) !== 0x23 /* # */) {
        return false;
      }

      const max = state.posMax;
      pos++;

      const wordStart = pos;
      let allNumeric = true;
      for (; pos < max; pos++) {
        const code = state.src.charCodeAt(pos);
        if (!isAlpha(code) && !isNumeric(code)) {
          break;
        }
        allNumeric = allNumeric && isNumeric(code);
      }
      const wordEnd = pos;

      if (wordStart === wordEnd || pos === max || allNumeric) {
        return false;
      }

      let token;

      if (!silent) {
        state.pos = wordStart;
        state.posMax = wordEnd;

        token = state.push("tag_open", "a", 1);

        const tagWord = state.src.slice(wordStart, wordEnd);
        token.attrs = [
          ["href", join("/", state.env.vault.rootUrl, "/tags/", tagWord)],
          ["class", "tag"],
        ];

        state.env.addTag(tagWord);

        const text = state.push("text");
        text.content = "#" + tagWord;

        state.push("tag_close", "a", -1);
      }

      state.pos = pos;
      state.posMax = max;
      return true;
    }
  );
}
