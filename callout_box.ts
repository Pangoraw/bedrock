import { isSpace, MarkdownIt, ParseBlockState } from "./ParseState.ts";
import { ParseEnv } from "./Vault.ts";

// Markdown link - [[Test]]
//
export default function callout_box(md: MarkdownIt, _opts: any) {
  md.block.ruler.before(
    "blockquote",
    "callout_box",
    function callout_box(
      state: ParseBlockState<ParseEnv>,
      startLine: number,
      endLine: number,
      silent: boolean
    ) {
      let pos = state.bMarks[startLine] + state.tShift[startLine];
      const max = state.eMarks[startLine];

      // if it's indented more than 3 spaces, it should be a code block
      if (state.sCount[startLine] - state.blkIndent >= 4) {
        return false;
      }

      // check the block quote marker
      if (state.src.charCodeAt(pos) !== 0x3e /* > */) {
        return false;
      }

      // we know that it's going to be a valid blockquote,
      // so no point trying to find the end of it in silent mode
      if (silent) {
        return true;
      }

      pos++;
      while (isSpace(state.src.charCodeAt(pos))) {
        pos++;
      }

      // This might be a regular blockquote and not a callout box
      if (
        pos < max &&
        (state.src.charCodeAt(pos) !== 0x5b /* [ */ ||
          state.src.charCodeAt(pos + 1) !== 0x21) /* ! */
      ) {
        return false;
      }
      pos += 2;

      const typeStart = pos;
      while (state.src.charCodeAt(pos) !== 0x5d /* ] */ && pos < max) {
        pos++;
      }

      if (pos === max) {
        return false;
      }
      const typeEnd = pos;
      const type = state.src.slice(typeStart, typeEnd).trim();

      startLine++;

      return blockquote_with_type(state, startLine, endLine, silent, type);
    }
  );
}

function blockquote_with_type(
  state: ParseBlockState,
  startLine: number,
  endLine: number,
  silent: boolean,
  type: string
) {
  let adjustTab,
    ch,
    i,
    initial,
    l,
    lastLineEmpty,
    lines,
    nextLine,
    offset,
    oldBMarks,
    oldBSCount,
    oldIndent,
    oldParentType,
    oldSCount,
    oldTShift,
    spaceAfterMarker,
    terminate,
    terminatorRules,
    token,
    isOutdented,
    oldLineMax = state.lineMax,
    pos = state.bMarks[startLine] + state.tShift[startLine],
    max = state.eMarks[startLine];

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }

  // check the block quote marker
  if (state.src.charCodeAt(pos) !== 0x3e /* > */) {
    return false;
  }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) {
    return true;
  }

  oldBMarks = [];
  oldBSCount = [];
  oldSCount = [];
  oldTShift = [];

  terminatorRules = state.md.block.ruler.getRules("blockquote");

  oldParentType = state.parentType;
  state.parentType = "blockquote";

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag:
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine; nextLine < endLine; nextLine++) {
    // check if it's outdented, i.e. it's inside list item and indented
    // less than said list item:
    //
    // ```
    // 1. anything
    //    > current blockquote
    // 2. checking this line
    // ```
    isOutdented = state.sCount[nextLine] < state.blkIndent;

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break;
    }

    if (state.src.charCodeAt(pos++) === 0x3e /* > */ && !isOutdented) {
      // This line is inside the blockquote.

      // set offset past spaces and ">"
      initial = state.sCount[nextLine] + 1;

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20 /* space */) {
        // ' >   test '
        //     ^ -- position start of line here:
        pos++;
        initial++;
        adjustTab = false;
        spaceAfterMarker = true;
      } else if (state.src.charCodeAt(pos) === 0x09 /* tab */) {
        spaceAfterMarker = true;

        if ((state.bsCount[nextLine] + initial) % 4 === 3) {
          // '  >\t  test '
          //       ^ -- position start of line here (tab has width===1)
          pos++;
          initial++;
          adjustTab = false;
        } else {
          // ' >\t  test '
          //    ^ -- position start of line here + shift bsCount slightly
          //         to make extra space appear
          adjustTab = true;
        }
      } else {
        spaceAfterMarker = false;
      }

      offset = initial;
      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      while (pos < max) {
        ch = state.src.charCodeAt(pos);

        if (isSpace(ch)) {
          if (ch === 0x09) {
            offset +=
              4 -
              ((offset + state.bsCount[nextLine] + (adjustTab ? 1 : 0)) % 4);
          } else {
            offset++;
          }
        } else {
          break;
        }

        pos++;
      }

      lastLineEmpty = pos >= max;

      oldBSCount.push(state.bsCount[nextLine]);
      state.bsCount[nextLine] =
        state.sCount[nextLine] + 1 + (spaceAfterMarker ? 1 : 0);

      oldSCount.push(state.sCount[nextLine]);
      state.sCount[nextLine] = offset - initial;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) {
      break;
    }

    // Case 3: another tag found.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }

    if (terminate) {
      // Quirk to enforce "hard termination mode" for paragraphs;
      // normally if you call `tokenize(state, startLine, nextLine)`,
      // paragraphs will look below nextLine for paragraph continuation,
      // but if blockquote is terminated by another tag, they shouldn't
      state.lineMax = nextLine;

      if (state.blkIndent !== 0) {
        // state.blkIndent was non-zero, we now set it to zero,
        // so we need to re-calculate all offsets to appear as
        // if indent wasn't changed
        oldBMarks.push(state.bMarks[nextLine]);
        oldBSCount.push(state.bsCount[nextLine]);
        oldTShift.push(state.tShift[nextLine]);
        oldSCount.push(state.sCount[nextLine]);
        state.sCount[nextLine] -= state.blkIndent;
      }

      break;
    }

    oldBMarks.push(state.bMarks[nextLine]);
    oldBSCount.push(state.bsCount[nextLine]);
    oldTShift.push(state.tShift[nextLine]);
    oldSCount.push(state.sCount[nextLine]);

    // A negative indentation means that this is a paragraph continuation
    //
    state.sCount[nextLine] = -1;
  }

  oldIndent = state.blkIndent;
  state.blkIndent = 0;

  token = state.push("blockquote_open", "blockquote", 1);
  token.markup = ">";
  token.map = lines = [startLine, 0];

  let cls;
  if (["help", "warning", "note"].includes(type)) {
    cls = `callout callout-${type}`;
  } else {
    cls = "callout callout-unknown";
  }
  token.attrs = [["class", cls]];

  const calloutTitle = state.push("callout_title");
  calloutTitle.content = type;

  state.md.block.tokenize(state, startLine, nextLine);

  token = state.push("blockquote_close", "blockquote", -1);
  token.markup = ">";

  state.lineMax = oldLineMax;
  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
    state.sCount[i + startLine] = oldSCount[i];
    state.bsCount[i + startLine] = oldBSCount[i];
  }
  state.blkIndent = oldIndent;

  return true;
}
