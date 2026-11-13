/**
 * The terminal's output model. Commands produce plain data (`Line[]`), never
 * markup, which keeps them pure, serialisable and trivially testable.
 */

export interface Picture {
  /** A mask whose alpha is the brightness; it is drawn in the phosphor colour. */
  src: string;
  alt: string;
  /** Height in rows of text. */
  rows: number;
  /**
   * The edge it floats against, text running down the other side; `art`:
   * against the right edge beside the ASCII art printed after it, `rows` and
   * `columns` being that art's size; or `block`, on rows of its own.
   */
  side: 'left' | 'right' | 'art' | 'block';
  /** Width of the art beside it, in characters; only for `art`. */
  columns?: number;
  /** Shows at once instead of being drawn in: it was already on the screen. */
  still?: boolean;
}

export type Tone = 'normal' | 'dim' | 'bright' | 'inverse';

export interface Span {
  text: string;
  tone?: Tone;
  /** Renders the span as an external link. */
  href?: string;
  /** Renders the span as a button that runs this command when activated. */
  command?: string;
  /** Table cell that is dropped when the screen is narrower than this. */
  hideBelow?: 'medium' | 'wide';
  /** On screens narrower than this, the span drops onto a row of its own, indented. */
  breakBelow?: 'medium';
  /** Shown only on screens narrower than this, on a row of its own. */
  showBelow?: 'medium';
  /** Left indent in characters; wrapped text stays under the indented start. */
  indent?: number;
}

export interface Line {
  spans: readonly Span[];
  /** Hanging indent in characters, applied to wrapped rows. */
  hang?: number;
  /** Milliseconds to wait before this line is printed. */
  delay?: number;
  /** Table row: stays on one line instead of wrapping. */
  nowrap?: boolean;
  /** Makes the whole row clickable; clicking it runs this command. */
  command?: string;
  /** Form feed: wipes the screen before this line is printed. */
  clear?: boolean;
  /** Preformatted ASCII art: never wraps, shrinks to fit narrow screens. */
  art?: boolean;
  /** A typed command line: output that overflows the screen is paged from here. */
  echo?: boolean;
  /** A picture instead of text; the lines printed after it run down its side. */
  image?: Picture;
  /** Shown only on wide screens, or only on narrow ones (below 46rem). */
  screen?: 'wide' | 'narrow';
}

type Part = string | Span;

const toSpan = (part: Part): Span => (typeof part === 'string' ? { text: part } : part);

export const line = (...parts: Part[]): Line => ({ spans: parts.map(toSpan) });

export const blank = (): Line => line('');

export const dim = (text: string): Span => ({ text, tone: 'dim' });

export const bright = (text: string): Span => ({ text, tone: 'bright' });

export const link = (text: string, href: string): Span => ({ text, href, tone: 'bright' });

/** A span that runs `command` when clicked; shows the command itself by default. */
export const action = (command: string, text: string = command): Span => ({
  text,
  command,
  tone: 'bright',
});

export const heading = (text: string): Line =>
  line({ text: ` ${text.toUpperCase()} `, tone: 'inverse' });

const BULLET = '  - ';

export const bullet = (...parts: Part[]): Line => ({
  spans: [toSpan(BULLET), ...parts.map(toSpan)],
  hang: BULLET.length,
});

export const art = (source: string): Line[] =>
  source
    .split('\n')
    .filter((row) => row.trim().length > 0)
    .map((row) => ({ spans: [{ text: row }], art: true }));

/** Returns a copy of `lines` whose rows are printed `delay` ms apart. */
export const paced = (lines: readonly Line[], delay: number): Line[] =>
  lines.map((entry) => ({ ...entry, delay }));

export const toPlainText = (entry: Line): string => entry.spans.map((part) => part.text).join('');
