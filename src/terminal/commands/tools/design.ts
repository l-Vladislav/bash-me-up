/**
 * Design-system arithmetic: unit conversion, type scales, fluid sizes,
 * colour contrast, layout grids and aspect ratios. The maths is plain exported
 * functions; the commands at the bottom only parse arguments and lay out lines.
 */
import { bright, dim, line } from '../../line';
import type { Line } from '../../line';
import type { Command } from '../types';

/** The browser default, and what `rem` means unless told otherwise. */
export const ROOT_SIZE = 16;

/** Rounds to `digits` decimals and drops trailing zeros: 1.50 -> "1.5". */
export const round = (value: number, digits = 3): string =>
  String(Number(value.toFixed(digits)) || 0);

const usage = (text: string, ...hints: string[]): Line[] => [
  line(`usage: ${text}`),
  ...hints.map((hint) => line(dim(`  ${hint}`))),
];

/** A positive number, or `undefined` for anything else. */
const positive = (text: string | undefined): number | undefined => {
  const value = Number(text);
  return text !== undefined && text.trim() !== '' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
};

/**
 * Rows of aligned columns that never wrap; the last column is left unpadded.
 * The first row is a dimmed header unless `header` is false; `tones` dims columns.
 */
const table = (
  rows: readonly (readonly string[])[],
  tones: readonly boolean[] = [],
  header = true,
): Line[] => {
  const widths = rows[0]?.map((_, column) =>
    Math.max(...rows.map((row) => (row[column] ?? '').length)),
  );
  return rows.map((row, index) => ({
    spans: row.map((cell, column) => {
      const text = column === row.length - 1 ? cell : cell.padEnd((widths?.[column] ?? 0) + 3);
      return (header && index === 0) || tones[column] ? dim(text) : { text };
    }),
    nowrap: true,
  }));
};

/* ---- rem: pixels and rems -------------------------------------------------- */

export interface Length {
  value: number;
  unit: 'px' | 'rem';
}

/** `24`, `24px`, `1.5rem` or `1.5em`; a bare number is pixels. */
export const parseLength = (text: string): Length | undefined => {
  const match = /^(\d*\.?\d+)(px|rem|em)?$/i.exec(text.trim());
  if (!match?.[1]) return undefined;
  const unit = (match[2] ?? 'px').toLowerCase();
  return { value: Number(match[1]), unit: unit === 'px' ? 'px' : 'rem' };
};

export const toPx = ({ value, unit }: Length, root = ROOT_SIZE): number =>
  unit === 'px' ? value : value * root;

const rem: Command = {
  name: 'rem',
  summary: 'Convert between px and rem',
  usage: '<size> [root]',
  run: ([size, rootArg]) => {
    const length = size === undefined ? undefined : parseLength(size);
    const root = rootArg === undefined ? ROOT_SIZE : positive(rootArg);
    if (!length || !root) {
      return {
        lines: usage('rem <size> [root px]', 'rem 24  ->  1.5rem', 'rem 1.5rem 18  ->  27px'),
      };
    }
    const px = toPx(length, root);
    const [from, to] =
      length.unit === 'px'
        ? [`${round(px)}px`, `${round(px / root, 4)}rem`]
        : [`${round(length.value, 4)}rem`, `${round(px)}px`];
    return { lines: [line(bright(from), ' = ', bright(to), dim(`   root ${round(root)}px`))] };
  },
};

/* ---- scale: modular type scale -------------------------------------------- */

/** Musical intervals, the usual names for type scale ratios. */
export const RATIOS: Readonly<Record<string, number>> = {
  'minor-second': 1.067,
  'major-second': 1.125,
  'minor-third': 1.2,
  'major-third': 1.25,
  'perfect-fourth': 1.333,
  'augmented-fourth': 1.414,
  'perfect-fifth': 1.5,
  golden: 1.618,
};

/** Token names for the steps, from two below the body size to six above. */
const STEPS = [
  ['xs', -2],
  ['sm', -1],
  ['base', 0],
  ['lg', 1],
  ['xl', 2],
  ['2xl', 3],
  ['3xl', 4],
  ['4xl', 5],
  ['5xl', 6],
] as const;

export const typeScale = (base: number, ratio: number): { token: string; px: number }[] =>
  STEPS.map(([token, step]) => ({ token, px: base * ratio ** step }));

const ratioName = (ratio: number): string | undefined =>
  Object.keys(RATIOS).find((name) => RATIOS[name] === ratio);

const scale: Command = {
  name: 'scale',
  summary: 'Modular type scale, from xs to 5xl',
  usage: '[base] [ratio]',
  run: ([baseArg, ratioArg]) => {
    const base = baseArg === undefined ? ROOT_SIZE : positive(baseArg);
    const ratio =
      ratioArg === undefined
        ? RATIOS['major-third']
        : (RATIOS[ratioArg.toLowerCase()] ?? positive(ratioArg));
    if (!base || !ratio || ratio <= 1) {
      return {
        lines: usage(
          'scale [base px] [ratio]',
          'scale 16 1.25   or   scale 16 major-third',
          `ratios: ${Object.keys(RATIOS).join(' ')}`,
        ),
      };
    }

    const name = ratioName(ratio);
    return {
      lines: [
        line(
          dim('base '),
          bright(`${round(base)}px`),
          dim('  ratio '),
          bright(round(ratio)),
          ...(name ? [dim(` (${name})`)] : []),
        ),
        line(''),
        ...table(
          [
            ['TOKEN', 'PX', 'REM'],
            ...typeScale(base, ratio).map(({ token, px }) => [
              token,
              round(px, 2),
              round(px / ROOT_SIZE, 4),
            ]),
          ],
          [false, false, true],
        ),
      ],
    };
  },
};

/* ---- fluid: clamp() between two viewport widths --------------------------- */

export interface Fluid {
  /** Size at the narrow and the wide viewport, in px. */
  min: number;
  max: number;
  /** Viewport widths between which the size grows, in px. */
  from: number;
  to: number;
}

/** A CSS `clamp()` that grows linearly from `min` at `from` to `max` at `to`. */
export const fluidClamp = ({ min, max, from, to }: Fluid, root = ROOT_SIZE): string => {
  const slope = (max - min) / (to - from);
  const intercept = min - slope * from;
  const remOf = (px: number): string => `${round(px / root, 4)}rem`;
  const sign = intercept < 0 ? '-' : '+';
  // Inverted ranges (shrinking as the screen grows) still need the smaller bound first.
  const preferred = `${round(slope * 100, 4)}vw ${sign} ${remOf(Math.abs(intercept))}`;
  return `clamp(${remOf(Math.min(min, max))}, ${preferred}, ${remOf(Math.max(min, max))})`;
};

const fluid: Command = {
  name: 'fluid',
  summary: 'CSS clamp() for a size that grows with the screen',
  usage: '<min> <max> [from] [to]',
  run: ([minArg, maxArg, fromArg = '320', toArg = '1280']) => {
    const min = minArg === undefined ? undefined : parseLength(minArg);
    const max = maxArg === undefined ? undefined : parseLength(maxArg);
    const from = positive(fromArg);
    const to = positive(toArg);
    if (!min || !max || !from || !to || from >= to) {
      return {
        lines: usage(
          'fluid <min> <max> [from px] [to px]',
          'fluid 16 24            16px at 320px wide, 24px at 1280px',
          'fluid 1rem 3rem 375 1440',
        ),
      };
    }
    const sizes: Fluid = { min: toPx(min), max: toPx(max), from, to };
    return {
      lines: [
        line(bright(`font-size: ${fluidClamp(sizes)};`)),
        line(
          dim(
            `${round(sizes.min)}px at ${round(from)}px wide, ${round(sizes.max)}px at ${round(to)}px and up`,
          ),
        ),
      ],
    };
  },
};

/* ---- colour: parsing, conversion, contrast -------------------------------- */

export type Rgb = readonly [number, number, number];

/** `#rgb`, `#rrggbb`, with or without the hash. */
export const parseHex = (text: string): Rgb | undefined => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!match?.[1]) return undefined;
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1];
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as unknown as Rgb;
};

/** A hex colour, or three 0-255 channels: `#ffb000`, `255 176 0`, `255,176,0`. */
export const parseColor = (args: readonly string[]): Rgb | undefined => {
  const parts = args
    .join(' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length === 1) return parseHex(parts[0] ?? '');
  if (parts.length !== 3) return undefined;
  const channels = parts.map(Number);
  return channels.every((c) => Number.isInteger(c) && c >= 0 && c <= 255)
    ? (channels as unknown as Rgb)
    : undefined;
};

export const toHex = (rgb: Rgb): string =>
  `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

/** Hue in degrees, saturation and lightness in percent. */
export const toHsl = ([r, g, b]: Rgb): Rgb => {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, Math.round(lightness * 100)];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return [
    Math.round((hue * 60 + 360) % 360),
    Math.round(saturation * 100),
    Math.round(lightness * 100),
  ];
};

/** WCAG relative luminance, 0 for black to 1 for white. */
export const luminance = (rgb: Rgb): number => {
  const [r = 0, g = 0, b = 0] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio, from 1 (none) to 21 (black on white). */
export const contrastRatio = (a: Rgb, b: Rgb): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

/** WCAG 2 thresholds for each kind of content. */
export const WCAG_LEVELS = [
  { level: 'AA', target: 'normal text', minimum: 4.5 },
  { level: 'AA', target: 'large text', minimum: 3 },
  { level: 'AA', target: 'UI components', minimum: 3 },
  { level: 'AAA', target: 'normal text', minimum: 7 },
  { level: 'AAA', target: 'large text', minimum: 4.5 },
] as const;

const contrast: Command = {
  name: 'contrast',
  summary: 'WCAG contrast ratio of two colours, AA and AAA',
  usage: '<fg> <bg>',
  run: ([first, second]) => {
    const a = first === undefined ? undefined : parseHex(first);
    const b = second === undefined ? undefined : parseHex(second);
    if (!a || !b) {
      return { lines: usage('contrast <color> <color>', 'contrast #ffb000 #050505') };
    }
    const ratio = contrastRatio(a, b);
    // WCAG says never round up: 4.499 does not pass 4.5.
    const shown = Math.floor(ratio * 100) / 100;
    return {
      lines: [
        line(dim(`${toHex(a)} on ${toHex(b)}  `), bright(`${shown.toFixed(2)}:1`)),
        line(''),
        ...WCAG_LEVELS.map(({ level, target, minimum }) => {
          const pass = ratio >= minimum;
          const label = `${level.padEnd(4)}${target.padEnd(15)}${`${minimum}:1`.padEnd(7)}`;
          return line(pass ? { text: label } : dim(label), pass ? bright('pass') : dim('fail'));
        }),
      ],
    };
  },
};

const color: Command = {
  name: 'color',
  summary: 'Convert a colour between hex, rgb and hsl',
  usage: '<hex|r g b>',
  run: (args) => {
    const rgb = parseColor(args);
    if (!rgb) return { lines: usage('color <hex | r g b>', 'color #ffb000', 'color 255 176 0') };
    const [h, s, l] = toHsl(rgb);
    const lum = luminance(rgb);
    return {
      lines: table(
        [
          ['hex', toHex(rgb)],
          ['rgb', `rgb(${rgb.join(' ')})`],
          ['hsl', `hsl(${h} ${s}% ${l}%)`],
          ['luminance', round(lum, 4)],
          [
            'best text',
            contrastRatio(rgb, [0, 0, 0]) >= contrastRatio(rgb, [255, 255, 255])
              ? 'black'
              : 'white',
          ],
        ],
        [true, false],
        false,
      ),
    };
  },
};

/* ---- grid: columns and gutters -------------------------------------------- */

export interface Grid {
  width: number;
  columns: number;
  gutter: number;
  margin: number;
}

/** Width of one column, or of `span` columns with the gutters between them. */
export const columnWidth = ({ width, columns, gutter, margin }: Grid, span = 1): number => {
  const column = (width - 2 * margin - gutter * (columns - 1)) / columns;
  return column * span + gutter * (span - 1);
};

const grid: Command = {
  name: 'grid',
  summary: 'Column widths of a layout grid',
  usage: '<w> <cols> <gap> [margin]',
  run: ([widthArg, columnsArg, gutterArg, marginArg = '0']) => {
    const width = positive(widthArg);
    const columns = positive(columnsArg);
    const gutter = Number(gutterArg);
    const margin = Number(marginArg);
    const valid =
      width !== undefined &&
      columns !== undefined &&
      Number.isInteger(columns) &&
      columns <= 24 &&
      gutterArg !== undefined &&
      Number.isFinite(gutter) &&
      gutter >= 0 &&
      Number.isFinite(margin) &&
      margin >= 0;
    if (!valid) {
      return {
        lines: usage(
          'grid <width> <columns> <gutter> [margin]',
          'grid 1280 12 24 32',
          'grid 375 4 16 16',
        ),
      };
    }

    const layout: Grid = { width, columns, gutter, margin };
    if (columnWidth(layout) <= 0) {
      return { lines: [line('grid: no room left for the columns; try fewer or narrower gutters')] };
    }
    return {
      lines: [
        line(
          dim('column '),
          bright(`${round(columnWidth(layout), 2)}px`),
          dim(`  gutter ${round(gutter)}px  margin ${round(margin)}px`),
        ),
        line(''),
        ...table(
          [
            ['SPAN', 'WIDTH', 'SHARE'],
            ...Array.from({ length: columns }, (_, index) => {
              const span = index + 1;
              return [
                String(span),
                `${round(columnWidth(layout, span), 2)}px`,
                `${round((span / columns) * 100, 2)}%`,
              ];
            }),
          ],
          [false, false, true],
        ),
      ],
    };
  },
};

/* ---- aspect: ratios and sizes --------------------------------------------- */

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** `1920 1080` -> `16:9`, in the smallest whole numbers. */
export const reduceRatio = (width: number, height: number): string => {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
};

const parseRatio = (text: string): [number, number] | undefined => {
  const match = /^(\d*\.?\d+)[:/x](\d*\.?\d+)$/i.exec(text);
  if (!match) return undefined;
  const [w, h] = [Number(match[1]), Number(match[2])];
  return w > 0 && h > 0 ? [w, h] : undefined;
};

const aspect: Command = {
  name: 'aspect',
  summary: 'Aspect ratio of a size, or a size from a ratio',
  usage: '<w> <h> | <w:h> <w>',
  run: ([first = '', second]) => {
    const ratio = parseRatio(first);
    if (ratio) {
      const width = positive(second);
      if (width) {
        const height = (width * ratio[1]) / ratio[0];
        return {
          lines: [line(bright(`${round(width, 2)} x ${round(height, 2)}`), dim(`   ${first}`))],
        };
      }
    }

    const width = positive(first);
    const height = positive(second);
    if (!ratio && width && height) {
      const whole = Number.isInteger(width) && Number.isInteger(height);
      return {
        lines: [
          line(
            ...(whole ? [bright(reduceRatio(width, height)), { text: '   ' }] : []),
            dim(`${round(width / height, 4)} : 1`),
          ),
        ],
      };
    }

    return {
      lines: usage(
        'aspect <w> <h>  or  aspect <w:h> <width>',
        'aspect 1920 1080  ->  16:9',
        'aspect 16:9 1280  ->  1280 x 720',
      ),
    };
  },
};

export const designCommands: readonly Command[] = [
  rem,
  scale,
  fluid,
  contrast,
  color,
  grid,
  aspect,
];
