export type MarkdownIt = any;

type AttrPair = [string, string];

export type Token<Meta = any> = {
  attrGet: (name: string) => string | null;
  attrIndex: (name: string) => number | null;
  attrJoin: (name: string, value: string) => void;
  attrPush: (pair: AttrPair) => void;
  attrSet: (name: string, string: string) => void;

  attrs: Array<AttrPair>;
  block: boolean;
  children: Array<Token>;
  content: string;
  hidden: boolean;
  info: string;
  level: number;
  map: [number, number];
  markup: string;
  meta: Meta;
  nesting: number;
  tag: string;
  type: string;
};

export interface ParseBlockState<E = Record<never, never>> {
  tokens: Array<Token>;
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
  tokens: Array<Token>;
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
