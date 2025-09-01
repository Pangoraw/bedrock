import { assertEquals, assertThrows } from "@std/assert";

type ASTNode = number | string | {
  head: "+" | "-" | "*" | "/" | "%" | "call" | "getproperty" | "identifier";
  children: ASTNode[];
};
type Value = any;

// Tokenizer
type Token = {
  type:
    | "number"
    | "string"
    | "boolean"
    | "identifier"
    | "operator"
    | "lparen"
    | "rparen"
    | "lbracket"
    | "rbracket"
    | "dot"
    | "comma"
    | "eof"
    | "eq"
    | "neq"
    | "lt"
    | "le"
    | "gt"
    | "ge"
    | "not";
  value: string | number | boolean;
  position: number;
};

class Tokenizer {
  private input: string;
  private position: number = 0;

  constructor(input: string) {
    this.input = input.trim();
  }

  private peek(): string {
    return this.input[this.position] || "";
  }

  private advance(): string {
    return this.input[this.position++] || "";
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.advance();
    }
  }

  nextToken(): Token {
    this.skipWhitespace();

    if (this.position >= this.input.length) {
      return { type: "eof", value: "", position: this.position };
    }

    const char = this.peek();
    const pos = this.position;

    // Numbers
    if (/\d/.test(char)) {
      let num = "";
      while (/[\d.]/.test(this.peek())) {
        num += this.advance();
      }
      return { type: "number", value: parseFloat(num), position: pos };
    }

    // Strings
    if (char === '"' || char === "'") {
      const quote = this.advance();
      let str = "";
      while (this.peek() && this.peek() !== quote) {
        if (this.peek() === "\\") {
          this.advance();
          const escaped = this.advance();
          str += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
        } else {
          str += this.advance();
        }
      }
      this.advance(); // consume closing quote
      return { type: "string", value: str, position: pos };
    }

    // Operators
    if (["+", "-", "/", "*"].includes(char)) {
      return { type: "operator", value: this.advance(), position: pos };
    }

    if (char === ">" || char === "<" || char === "=" || char === "!") {
      let value = this.advance();
      if (this.peek() == "=") value += this.advance();

      const operator = {
        "!": "not",
        "!=": "neq",
        "==": "eq",
        ">": "gt",
        ">=": "ge",
        "<": "lt",
        "<=": "le",
      }[value] as string;

      return { type: "operator", value: operator, position: pos };
    }

    // Punctuation
    if (char === "(") {
      return { type: "lparen", value: this.advance(), position: pos };
    }
    if (char === ")") {
      return { type: "rparen", value: this.advance(), position: pos };
    }
    if (char === "[") {
      return { type: "lbracket", value: this.advance(), position: pos };
    }
    if (char === "]") {
      return { type: "rbracket", value: this.advance(), position: pos };
    }
    if (char === ".") {
      return { type: "dot", value: this.advance(), position: pos };
    }
    if (char === ",") {
      return { type: "comma", value: this.advance(), position: pos };
    }

    // Identifiers
    if (/[a-zA-Z_]/.test(char)) {
      let ident = "";
      while (/[a-zA-Z0-9_]/.test(this.peek())) {
        ident += this.advance();
      }

      if (ident === "true") {
        return { type: "boolean", value: true, position: pos };
      }
      if (ident === "false") {
        return { type: "boolean", value: false, position: pos };
      }

      return { type: "identifier", value: ident, position: pos };
    }

    throw new Error(
      `Unexpected character '${char}' at position ${this.position}`,
    );
  }
}

class Parser {
  private tokens: Token[] = [];
  private position: number = 0;

  private peek(): Token {
    return this.tokens[this.position] ||
      { type: "eof", value: "", position: -1 };
  }

  private advance(): Token {
    return this.tokens[this.position++] ||
      { type: "eof", value: "", position: -1 };
  }

  private expect(type: Token["type"]): Token {
    const token = this.advance();
    if (token.type !== type) {
      throw new Error(
        `Expected ${type} but got ${token.type} at position ${token.position}`,
      );
    }
    return token;
  }

  parse(input: string): ASTNode {
    const tokenizer = new Tokenizer(input);
    this.tokens = [];
    this.position = 0;

    // Tokenize all input
    let token: Token;
    do {
      token = tokenizer.nextToken();
      this.tokens.push(token);
    } while (token.type !== "eof");

    const expr = this.parseExpression();

    if (this.tokens.length != this.position + 1) {
      throw "unexpected token '" + this.tokens[this.position].value + "' at " +
        this.tokens[this.position].position;
    }

    return expr;
  }

  private parseExpression(): ASTNode {
    return this.parseOperator();
  }

  private parseOperator(): ASTNode {
    let left = this.parseAddition();

    while (
      this.peek().type === "operator" &&
      ["eq", "neq", "lt", "le", "gt", "ge"].includes(this.peek().value)
    ) {
      const op = this.advance();
      const right = this.parseAddition();
      left = { head: op.value as "eq", children: [left, right] };
    }

    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseSubtraction();

    while (this.peek().type === "operator" && this.peek().value === "+") {
      this.advance(); // consume '+'
      const right = this.parseSubtraction();
      left = { head: "+", children: [left, right] };
    }

    return left;
  }

  private parseSubtraction(): ASTNode {
    let left = this.parseMultiplication();

    while (this.peek().type === "operator" && this.peek().value === "-") {
      this.advance(); // consume '-'
      const right = this.parseMultiplication();
      left = { head: "-", children: [left, right] };
    }

    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parsePostfix();

    while (this.peek().type === "operator" && this.peek().value === "*") {
      this.advance(); // consume '*'
      const right = this.parsePostfix();
      left = { head: "*", children: [left, right] };
    }

    return left;
  }

  private parsePostfix(): ASTNode {
    let expr = this.parsePrimary();

    while (true) {
      if (this.peek().type === "dot") {
        this.advance(); // consume '.'
        const property = this.expect("identifier");
        expr = {
          head: "getproperty",
          children: [expr, property.value as string],
        };
      } else if (this.peek().type === "lparen") {
        this.advance(); // consume '('
        const args: ASTNode[] = [];

        if (this.peek().type !== "rparen") {
          args.push(this.parseExpression());
          while (this.peek().type === "comma") {
            this.advance(); // consume ','
            args.push(this.parseExpression());
          }
        }

        this.expect("rparen");
        expr = { head: "call", children: [expr, ...args] };
      } else if (this.peek().type === "lbracket") {
        this.advance(); // consume '['
        const args: ASTNode[] = [];

        if (this.peek().type !== "rbracket") {
          args.push(this.parseExpression());
        }

        this.expect("rbracket");
        expr = { head: "getproperty", children: [expr, ...args] };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();

    if (token.type === "number") {
      this.advance();
      return token.value as number;
    }

    if (token.type === "string") {
      this.advance();
      return token.value as string;
    }

    if (token.type === "boolean") {
      this.advance();
      return token.value as boolean;
    }

    if (token.type === "identifier") {
      this.advance();
      return { head: "identifier", children: [token.value as string] };
    }

    if (token.type === "lparen") {
      this.advance(); // consume '('
      const expr = this.parseExpression();
      this.expect("rparen");
      return expr;
    }

    if (
      token.type === "operator" &&
      (token.value === "+" || token.value === "-" || token.value === "not")
    ) {
      const infix = this.advance();
      const expr = this.parseExpression();
      return { head: infix.value as ("+" | "-"), children: [expr] };
    }

    throw new Error(
      `Unexpected token ${token.type} at position ${token.position}`,
    );
  }
}

export function parse(expr: string): ASTNode {
  const parser = new Parser();
  return parser.parse(expr);
}

export function evaluate(
  ast: ASTNode,
  env: { [variable: string]: any },
): Value {
  // Leaf nodes
  if (typeof ast === "number") {
    return ast;
  }

  if (typeof ast === "string") {
    return ast;
  }

  if (typeof ast === "boolean") {
    return ast;
  }

  // AST nodes with operations
  const { head, children } = ast;

  switch (head) {
    case "+":
      if (children.length === 1) return +evaluate(children[0], env);
      if (children.length !== 2) {
        throw new Error("Addition requires exactly 2 operands");
      }
      const left = evaluate(children[0], env);
      const right = evaluate(children[1], env);
      return left + right;

    case "-":
      if (children.length === 1) return -evaluate(children[0], env);
      if (children.length !== 2) {
        throw new Error("Subtraction requires exactly 2 operands");
      }
      const leftSub = evaluate(children[0], env);
      const rightSub = evaluate(children[1], env);
      return leftSub - rightSub;

    case "*":
      if (children.length !== 2) {
        throw new Error("Multiplication requires exactly 2 operands");
      }
      const leftMul = evaluate(children[0], env);
      const rightMul = evaluate(children[1], env);
      return leftMul * rightMul;

    case "eq":
    case "neq":
    case "lt":
    case "le":
    case "gt":
    case "ge":
      if (children.length !== 2) {
        throw new Error("Comparison requires exactly 2 operands");
      }

      const cmpFn: (a: Value, b: Value) => bool = {
        "eq": (a, b) => a == b,
        "neq": (a, b) => a != b,
        "lt": (a, b) => a < b,
        "le": (a, b) => a <= b,
        "gt": (a, b) => a > b,
        "ge": (a, b) => a >= b,
      }[head];

      const leftCmp = evaluate(children[0], env);
      const rightCmp = evaluate(children[1], env);

      return cmpFn(leftCmp, rightCmp);

    case "not":
      return !evaluate(children[0], env);

    case "call":
      if (children.length < 1) {
        throw new Error("Function call requires at least a function");
      }
      let func = evaluate(children[0], env);

      if (typeof func === "object") {
        func = func["__call"].bind(func);
      }

      if (typeof func !== "function") {
        console.log(children);
        throw new Error("Function " + children[0] + " is not a function");
      }

      const args = children.slice(1).map((arg) => evaluate(arg, env));

      if (typeof func !== "function") {
        throw new Error("Cannot call non-function value");
      }

      return func(...args);

    case "getproperty":
      if (children.length !== 2) {
        throw new Error("Property access requires exactly 2 operands");
      }
      const obj = evaluate(children[0], env);
      const prop = evaluate(children[1], env); // property name is already a string

      if (obj == null) {
        console.log(children[0]);
        throw new Error("Cannot access property of null or undefined");
      }

      const val = obj[prop];
      if (typeof val === "function") return val.bind(obj);

      return val;
    case "identifier":
      return env[children[0] as string];

    default:
      throw new Error(`Unknown operation: ${head}`);
  }
}

Deno.test(
  "parser",
  () => {
    assertEquals(evaluate(parse("1 + 2"), {}), 3);
    assertEquals(evaluate(parse("1 * 3"), {}), 3);
    assertEquals(evaluate(parse("2 * 3 + 5"), {}), 11);
    assertThrows(() => parse("* 1"));
    assertThrows(() => parse(""));
  },
);

Deno.test("func calls", () => {
  assertEquals(
    evaluate(parse("f()"), { f: () => 42 }),
    42,
  );
});
