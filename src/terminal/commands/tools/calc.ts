/**
 * A small calculator: + - * / % ^, parentheses, unary minus, a few functions
 * and constants. A recursive-descent parser, so no `eval` is ever involved.
 *
 *   expression := term (('+' | '-') term)*
 *   term       := power (('*' | '/' | '%') power)*
 *   power      := unary ('^' power)?
 *   unary      := '-' unary | primary
 *   primary    := number | name | name '(' expression ')' | '(' expression ')'
 */

const CONSTANTS: Readonly<Record<string, number>> = { pi: Math.PI, e: Math.E };

const FUNCTIONS: Readonly<Record<string, (x: number) => number>> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

export const CALC_NAMES = [...Object.keys(CONSTANTS), ...Object.keys(FUNCTIONS)];

export class CalcError extends Error {}

const TOKEN = /\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[a-z]+|[-+*/%^()])/iy;

const tokenize = (source: string): string[] => {
  const tokens: string[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match?.[1]) {
      if (source.slice(start).trim() === '') break;
      throw new CalcError(`unexpected "${source.slice(start).trim().charAt(0)}"`);
    }
    tokens.push(match[1].toLowerCase());
  }
  return tokens;
};

export const evaluate = (source: string): number => {
  const tokens = tokenize(source);
  let position = 0;

  const peek = (): string | undefined => tokens[position];
  const take = (): string => {
    const token = tokens[position++];
    if (token === undefined) throw new CalcError('unexpected end of expression');
    return token;
  };
  const expect = (token: string): void => {
    if (take() !== token) throw new CalcError(`expected "${token}"`);
  };

  const expression = (): number => {
    let value = term();
    for (let op = peek(); op === '+' || op === '-'; op = peek()) {
      take();
      value = op === '+' ? value + term() : value - term();
    }
    return value;
  };

  const term = (): number => {
    let value = power();
    for (let op = peek(); op === '*' || op === '/' || op === '%'; op = peek()) {
      take();
      const right = power();
      value = op === '*' ? value * right : op === '/' ? value / right : value % right;
    }
    return value;
  };

  const power = (): number => {
    const base = unary();
    if (peek() !== '^') return base;
    take();
    return base ** power();
  };

  const unary = (): number => {
    if (peek() === '-') {
      take();
      return -unary();
    }
    if (peek() === '+') {
      take();
      return unary();
    }
    return primary();
  };

  const primary = (): number => {
    const token = take();
    if (token === '(') {
      const value = expression();
      expect(')');
      return value;
    }
    if (/^[\d.]/.test(token)) return Number(token);

    const fn = FUNCTIONS[token];
    if (fn) {
      expect('(');
      const value = expression();
      expect(')');
      return fn(value);
    }
    const constant = CONSTANTS[token];
    if (constant !== undefined) return constant;
    throw new CalcError(`unknown name "${token}"`);
  };

  if (tokens.length === 0) throw new CalcError('nothing to calculate');
  const result = expression();
  if (position < tokens.length) throw new CalcError(`unexpected "${tokens[position] ?? ''}"`);
  return result;
};

/** Up to 12 significant digits, without trailing zeros. */
export const formatNumber = (value: number): string => {
  if (Number.isNaN(value)) return 'not a number';
  if (!Number.isFinite(value)) return value > 0 ? 'infinity' : '-infinity';
  return String(Number(value.toPrecision(12)));
};
