export type MarkdownIt = any;
export type Token = any;

export interface ParseBlockState<E = Record<never, never>> {
  src: string;
  md: MarkdownIt;

  line: number;
  lineMax: number;
  tight: boolean; // loose/tight mode for lists
  ddIndent: number; // indent of the current dd block (-1 if there isn't any)
  listIndent: number; // indent of the current list block (-1 if there isn't any)

  parentType: "blockquote" | "list" | "root" | "paragraph" | "reference";
  level: number;

  blkIndent: number;
  tShift: Array<number>; // offsets of the first non-space characters (tabs not expanded)

  // An amount of virtual spaces (tabs expanded) between beginning
  // of each line (bMarks) and real beginning of that line.
  bsCount: Array<number>;
  bMarks: Array<number>; // line begin offsets for fast jumps
  eMarks: Array<number>; // line end offsets for fast jumps
  sCount: Array<number>; // indents for each line (tabs expanded)

  env: E;

  push(token_type: string, tag?: string, nesting?: number | string): Token;
}

export interface ParseInlineState<E = Record<never, never>> {
  src: string;
  md: MarkdownIt;
  pos: number;
  posMax: number;
  linkLevel: number;
  lineMax: number;
  env: E;

  push(token_type: string, tag?: string, nesting?: number | string): Token;
}

export const isSpace = (code: number): boolean => {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
  }
  return false;
};
