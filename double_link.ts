import { slugify } from "https://deno.land/x/slugify@0.3.0/mod.ts";
import { join } from "https://deno.land/std@0.165.0/path/posix.ts";
import { MarkdownIt, ParseInlineState } from "./ParseState.ts";
import { ParseEnv } from "./Vault.ts";

// Markdown link - [[Test]]
//
export default function double_link_plugin(md: MarkdownIt, _opts: any) {
  md.inline.ruler.before(
    "link",
    "double_link",
    function double_link(state: ParseInlineState<ParseEnv>, silent: boolean) {
      let pos = state.pos;
      let is_embed = false;

      if (state.src.charCodeAt(pos) === 0x21 /* ! */) {
        is_embed = true;
        pos++;
      }

      if (
        state.src.charCodeAt(pos) !== 0x5b /* [ */ ||
        state.src.charCodeAt(pos + 1) !== 0x5b /* [ */
      ) {
        return false;
      }

      const max = state.posMax;

      const labelStart = pos + 2;

      const res = parseLabel(state, labelStart);
      if (res === undefined) return false;
      const { labelEnd, label, alias, anchor } = res;

      // parser failed to find ']', so it's not a valid link
      if (labelEnd < 0) {
        return false;
      }

      pos = labelEnd;
      if (
        pos < max &&
        (state.src.charCodeAt(pos) !== 0x5d /* ] */ ||
          state.src.charCodeAt(pos + 1) !== 0x5d) /* ] */
      ) {
        return false;
      }
      pos += 2;

      let token;

      if (!silent) {
        if (is_embed) {
          state.pos = labelStart;
          state.posMax = labelEnd;

          const maybeNote = state.env.vault.findNoteByName(label);

          if (maybeNote === undefined) {
            const imgSrc = state.env.findAsset(label);
            token = state.push("image", "img", 0);
            token.children = []; // Add empty children list
            token.attrs = [
              ["src", imgSrc],
              ["alt", label],
            ];
            if (alias !== undefined) {
              token.attrPush(["width", alias]);
            }
          } else {
            const tokens = maybeNote.renderTokens();
            for (const token of tokens) {
              state.tokens.push(token);
            }
          }
        } else {
          let note = state.env.vault.findNoteByName(label);

          // Try by path instead
          if (note === undefined) {
            note = state.env.vault.findNoteByPath(join("/", label) + ".md");
          }

          let path;
          if (note === undefined) {
            path = label + ".html";
          } else {
            state.env.addReference(note);
            path = note.url().replace(".md", ".html");
            if (anchor !== undefined) {
              path += "#" + slugify(anchor);
            }
          }
          state.pos = labelStart;
          state.posMax = labelEnd;

          token = state.push("link_open", "a", 1);
          token.attrs = [["href", path]];

          const text = state.push("text");
          text.content = alias ?? label;

          token = state.push("link_close", "a", -1);
        }
      }
      state.pos = pos;
      state.posMax = max;
      return true;
    }
  );
}

// Assumes that pos is at '[' + 1
const parseLabel = (
  state: ParseInlineState,
  pos: number
):
  | { labelEnd: number; alias?: string; label: string; anchor?: string }
  | undefined => {
  const labelStart = pos;

  while (
    pos < state.posMax &&
    state.src.charCodeAt(pos) !== 0x5d /* ] */ &&
    state.src.charCodeAt(pos) !== 0x7c /* | */ &&
    state.src.charCodeAt(pos) !== 0x23 /* # */
  ) {
    pos++;
  }

  if (pos === state.posMax) return undefined;

  let alias = undefined;
  let label;
  let anchor = undefined;

  if (state.src.charCodeAt(pos) === 0x23 /* # */) {
    label = state.src.slice(labelStart, pos);
    const anchorStart = pos;
    while (
      pos < state.posMax &&
      state.src.charCodeAt(pos) !== 0x5d /* ] */ &&
      state.src.charCodeAt(pos) !== 0x7c /* | */
    ) {
      pos++;
    }

    if (pos === state.posMax) {
      return undefined;
    }

    anchor = state.src.slice(anchorStart + 1, pos);
  }

  if (state.src.charCodeAt(pos) === 0x7c /* | */) {
    if (label === undefined) {
      label = state.src.slice(labelStart, pos);
    }
    const aliasStart = pos;

    while (pos < state.posMax && state.src.charCodeAt(pos) !== 0x5d /* ] */) {
      pos++;
    }

    if (pos === state.posMax) {
      return undefined;
    }

    alias = state.src.slice(aliasStart + 1, pos);
  }

  if (label === undefined) {
    label = state.src.slice(labelStart, pos);
  }

  if (anchor !== undefined && alias === undefined) {
    alias = `${label} > ${anchor}`;
  }

  return {
    labelEnd: pos,
    alias,
    label,
    anchor,
  };
};
