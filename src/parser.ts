import type {
  ConstraintDefinition,
  LinearExpression,
  LinearProgram,
  Relation,
  VariableDefinition
} from "./model";

export class GmplParseError extends Error {
  constructor(message: string, readonly statement?: string) {
    super(statement ? `${message}\nIn: ${statement.trim()}` : message);
    this.name = "GmplParseError";
  }
}

type Token = { type: "number" | "identifier" | "operator" | "paren"; value: string };

const EPSILON = 1e-12;

function clean(value: number): number {
  return Math.abs(value) < EPSILON ? 0 : value;
}

function add(left: LinearExpression, right: LinearExpression, scale = 1): LinearExpression {
  const coefficients = { ...left.coefficients };
  for (const [name, coefficient] of Object.entries(right.coefficients)) {
    coefficients[name] = clean((coefficients[name] ?? 0) + scale * coefficient);
    if (coefficients[name] === 0) delete coefficients[name];
  }
  return { coefficients, constant: clean(left.constant + scale * right.constant) };
}

function scale(expression: LinearExpression, factor: number): LinearExpression {
  return {
    coefficients: Object.fromEntries(
      Object.entries(expression.coefficients).map(([name, coefficient]) => [name, clean(coefficient * factor)])
    ),
    constant: clean(expression.constant * factor)
  };
}

function isScalar(expression: LinearExpression): boolean {
  return Object.keys(expression.coefficients).length === 0;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      index += whitespace[0].length;
      continue;
    }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ type: "number", value: number[0] });
      index += number[0].length;
      continue;
    }
    const identifier = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      tokens.push({ type: "identifier", value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const character = source[index]!;
    if ("+-*/".includes(character)) tokens.push({ type: "operator", value: character });
    else if ("()".includes(character)) tokens.push({ type: "paren", value: character });
    else throw new GmplParseError(`Unexpected character “${character}” in expression.`);
    index += 1;
  }
  return tokens;
}

export function parseLinearExpression(source: string): LinearExpression {
  const tokens = tokenize(source);
  let cursor = 0;

  const peek = (): Token | undefined => tokens[cursor];
  const take = (): Token => {
    const token = tokens[cursor];
    if (!token) throw new GmplParseError("Unexpected end of expression.");
    cursor += 1;
    return token;
  };

  const primary = (): LinearExpression => {
    const token = take();
    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      return scale(primary(), token.value === "-" ? -1 : 1);
    }
    if (token.type === "number") return { coefficients: {}, constant: Number(token.value) };
    if (token.type === "identifier") return { coefficients: { [token.value]: 1 }, constant: 0 };
    if (token.type === "paren" && token.value === "(") {
      const value = sum();
      const closing = take();
      if (closing.type !== "paren" || closing.value !== ")") throw new GmplParseError("Expected a closing parenthesis.");
      return value;
    }
    throw new GmplParseError(`Unexpected token “${token.value}”.`);
  };

  const product = (): LinearExpression => {
    let left = primary();
    while (peek()?.type === "operator" && (peek()?.value === "*" || peek()?.value === "/")) {
      const operator = take().value;
      const right = primary();
      if (operator === "*") {
        if (isScalar(left)) left = scale(right, left.constant);
        else if (isScalar(right)) left = scale(left, right.constant);
        else throw new GmplParseError("Non-linear products are not supported.");
      } else {
        if (!isScalar(right) || right.constant === 0) throw new GmplParseError("A linear expression can only be divided by a non-zero number.");
        left = scale(left, 1 / right.constant);
      }
    }
    return left;
  };

  const sum = (): LinearExpression => {
    let left = product();
    while (peek()?.type === "operator" && (peek()?.value === "+" || peek()?.value === "-")) {
      const operator = take().value;
      left = add(left, product(), operator === "+" ? 1 : -1);
    }
    return left;
  };

  if (tokens.length === 0) throw new GmplParseError("Expected a linear expression.");
  const expression = sum();
  if (cursor !== tokens.length) throw new GmplParseError(`Unexpected token “${tokens[cursor]!.value}”.`);
  return expression;
}

function parseFiniteNumber(value: string, statement: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new GmplParseError(`Invalid numeric bound “${value}”.`, statement);
  return number;
}

function parseVariable(statement: string): VariableDefinition {
  const match = statement.match(/^var\s+([A-Za-z_][A-Za-z0-9_]*)([\s\S]*)$/i);
  if (!match) throw new GmplParseError("Invalid variable declaration.", statement);
  const name = match[1]!;
  const tail = match[2] ?? "";
  const kind = /\bbinary\b/i.test(tail) ? "binary" : /\binteger\b/i.test(tail) ? "integer" : "continuous";
  let lower = kind === "binary" ? 0 : Number.NEGATIVE_INFINITY;
  let upper = kind === "binary" ? 1 : Number.POSITIVE_INFINITY;
  const bounds = [...tail.matchAll(/(>=|<=|=)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/g)];
  for (const bound of bounds) {
    const value = parseFiniteNumber(bound[2]!, statement);
    if (bound[1] === ">=") lower = value;
    else if (bound[1] === "<=") upper = value;
    else lower = upper = value;
  }
  if (lower > upper) throw new GmplParseError(`Variable ${name} has inconsistent bounds.`, statement);
  return { name, lower, upper, kind };
}

function parseConstraint(statement: string, fallbackName: string): ConstraintDefinition {
  const prefix = statement.match(/^(?:subject\s+to|s\.t\.|subj\.?\s+to)?\s*([A-Za-z_][A-Za-z0-9_]*)?\s*:\s*([\s\S]+)$/i);
  if (!prefix) throw new GmplParseError("Invalid constraint. Expected `subject to name: expression <= value`.", statement);
  const body = prefix[2]!;
  const relationMatch = body.match(/^([\s\S]*?)(<=|>=|=)([\s\S]*)$/);
  if (!relationMatch) throw new GmplParseError("A constraint must contain <=, >=, or =.", statement);
  const left = parseLinearExpression(relationMatch[1]!);
  const right = parseLinearExpression(relationMatch[3]!);
  const normalized = add(left, right, -1);
  return {
    name: prefix[1] ?? fallbackName,
    expression: { coefficients: normalized.coefficients, constant: 0 },
    relation: relationMatch[2] as Relation,
    rhs: -normalized.constant
  };
}

export function parseGmpl(source: string): LinearProgram {
  const withoutComments = source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, ""))
    .join("\n");
  const statements = withoutComments.split(";").map((statement) => statement.trim()).filter(Boolean);
  const variables: VariableDefinition[] = [];
  const constraints: ConstraintDefinition[] = [];
  let objective: LinearProgram["objective"] | undefined;

  for (const statement of statements) {
    if (/^end$/i.test(statement)) continue;
    if (/^var\b/i.test(statement)) {
      const variable = parseVariable(statement);
      if (variables.some(({ name }) => name === variable.name)) throw new GmplParseError(`Variable ${variable.name} is declared more than once.`, statement);
      variables.push(variable);
      continue;
    }
    const objectiveMatch = statement.match(/^(maximize|minimize)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([\s\S]+)$/i);
    if (objectiveMatch) {
      if (objective) throw new GmplParseError("Only one objective is supported.", statement);
      objective = {
        sense: objectiveMatch[1]!.toLowerCase() as "maximize" | "minimize",
        name: objectiveMatch[2]!,
        expression: parseLinearExpression(objectiveMatch[3]!)
      };
      continue;
    }
    if (/^(?:subject\s+to\b|s\.t\.|subj\.?\s+to\b)/i.test(statement)) {
      const constraint = parseConstraint(statement, `c${constraints.length + 1}`);
      if (constraints.some(({ name }) => name === constraint.name)) throw new GmplParseError(`Constraint ${constraint.name} is declared more than once.`, statement);
      constraints.push(constraint);
      continue;
    }
    throw new GmplParseError("Unsupported or unrecognized statement.", statement);
  }

  if (!objective) throw new GmplParseError("The model needs one `maximize` or `minimize` objective.");
  const declared = new Set(variables.map(({ name }) => name));
  const referenced = new Set([
    ...Object.keys(objective.expression.coefficients),
    ...constraints.flatMap(({ expression }) => Object.keys(expression.coefficients))
  ]);
  for (const name of referenced) {
    if (!declared.has(name)) throw new GmplParseError(`Variable ${name} is used but not declared.`);
  }
  if (variables.length === 0) throw new GmplParseError("The model does not declare any variables.");
  return { variables, objective, constraints };
}
