import { MarkdownIt, ParseInlineState } from "./ParseState.ts";
import { ParseEnv } from "./Vault.ts";

function isAlphanumeric(code: number): boolean {
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
      for (; pos < max; pos++) {
        const code = state.src.charCodeAt(pos);
        if (!isAlphanumeric(code)) {
          break;
        }
      }
      const wordEnd = pos;

      let token;

      if (!silent) {
        state.pos = wordStart;
        state.posMax = wordEnd;

        token = state.push("tag_open", "a", 1);

        const tagWord = state.src.slice(wordStart, wordEnd);
        token.attrs = [
          ["href", "/tags/" + tagWord],
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
