import { MarkdownIt, ParseBlockState } from "./ParseState.ts";
import { ParseEnv } from "./Vault.ts";
import { parse } from "https://deno.land/std@0.194.0/yaml/mod.ts";

export default function frontmatter(md: MarkdownIt, _opts: any) {
  md.block.ruler.before(
    "hr",
    "frontmatter",
    function frontmatter(
      state: ParseBlockState<ParseEnv>,
      startLine: number,
      endLine: number,
      silent: boolean
    ) {
      if (startLine != 0) return false;

      let pos = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[endLine];

      if (
        startLine == endLine ||
        max - pos < 3 ||
        state.src.charCodeAt(pos) !== 0x2d /* - */ ||
        state.src.charCodeAt(pos + 1) !== 0x2d /* - */ ||
        state.src.charCodeAt(pos + 2) !== 0x2d /* - */
      ) {
        return false;
      }

      let cur_line = startLine + 1;

      const new_line_pos = state.bMarks[cur_line];
      const toml_start = new_line_pos;
      pos = new_line_pos;

      if (pos > max) return false;

      let toml_end = null;
      while (pos <= max) {
        if (state.src.charCodeAt(pos) === 0x0a /* \n */) {
            cur_line++;
        }
        if (
          max - pos >= 3 &&
          state.src.charCodeAt(pos) === 0x2d /* - */ &&
          state.src.charCodeAt(pos + 1) === 0x2d /* - */ &&
          state.src.charCodeAt(pos + 2) === 0x2d /* - */
        ) {
          toml_end = pos - 1;
          break;
        }
        pos++;
      }

      if (toml_end === null) return false;

      const tomlString = state.src.slice(toml_start, toml_end);
      const toml = parse(tomlString);

      for (const [k, v] of Object.entries(toml)) {
        state.env.addProperty(k, v);
      }

      if (!silent) {
        state.line = cur_line + 1;
        return true;
      }
    }
  );
}
