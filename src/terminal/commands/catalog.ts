import { action, blank, dim, heading, line } from '../line';
import type { Line, Span } from '../line';
import type { Command } from './types';

export interface Column<T> {
  /** Header text, shown in capitals. */
  title: string;
  value: (item: T) => string;
  /** Dimmed cells read as secondary information. */
  dim?: boolean;
  /** Drops the column on narrow screens instead of wrapping the row. */
  hideBelow?: Span['hideBelow'];
}

/**
 * A list of things shown as a table, each with a page of its own:
 * `name` prints the table, `name <n>` opens item n.
 */
export interface Catalog<T> {
  name: string;
  summary: string;
  /** Singular noun for one item, e.g. "project". */
  noun: string;
  items: readonly T[];
  /** First column; its cells are the links to the item pages. */
  label: Column<T>;
  columns: readonly Column<T>[];
  details: (item: T) => Line[];
}

const COLUMN_GAP = 3;

const columnWidth = <T>(column: Column<T>, items: readonly T[]): number =>
  Math.max(column.title.length, ...items.map((item) => column.value(item).length)) + COLUMN_GAP;

const table = <T>({ name, items, label, columns }: Catalog<T>): Line[] => {
  const indexWidth = `[${items.length}]`.length + 1;
  const labelWidth = columnWidth(label, items);
  const widths = columns.map((column) => columnWidth(column, items));

  // The last column is left unpadded so trailing spaces never trigger the ellipsis.
  const fit = (text: string, column: number): string =>
    column === columns.length - 1 ? text : text.padEnd(widths[column] ?? 0);

  const cell = (column: Column<T>, index: number, text: string, tone: boolean): Span => ({
    ...(tone ? dim(fit(text, index)) : { text: fit(text, index) }),
    hideBelow: column.hideBelow,
  });

  const header: Line = {
    spans: [
      dim(' #'.padEnd(indexWidth)),
      dim(label.title.padEnd(labelWidth)),
      ...columns.map((column, index) => cell(column, index, column.title, true)),
    ],
    nowrap: true,
  };

  const rows = items.map((item, index): Line => {
    const command = `${name} ${index + 1}`;
    const text = label.value(item);
    return {
      spans: [
        dim(`[${index + 1}]`.padEnd(indexWidth)),
        action(command, text),
        { text: ' '.repeat(labelWidth - text.length) },
        ...columns.map((column, at) => cell(column, at, column.value(item), column.dim ?? false)),
      ],
      nowrap: true,
      command,
    };
  });

  return [header, ...rows];
};

export const catalogCommand = <T>(catalog: Catalog<T>): Command => {
  const { name, noun, items } = catalog;
  const range = `1-${items.length}`;

  return {
    name,
    summary: catalog.summary,
    usage: `[${range}]`,
    options: items.map((_, index) => String(index + 1)),
    run: ([selector]) => {
      if (selector === undefined) {
        return {
          lines: [
            heading(name),
            blank(),
            ...table(catalog),
            blank(),
            line(dim(`Select a ${noun} or type \`${name} <n>\`, e.g. `), action(`${name} 1`)),
          ],
        };
      }

      const index = Number(selector) - 1;
      const item = items[index];
      if (item === undefined) {
        return { lines: [line(`${name}: no entry "${selector}" (expected ${range})`)] };
      }

      // Navigation shares the title row, so a page costs no extra lines.
      const next = ((index + 1) % items.length) + 1;
      const title: Line = {
        spans: [
          ...heading(`${noun} ${index + 1}/${items.length}`).spans,
          { text: '   ' },
          action(name, `< all ${name}`),
          { text: '   ' },
          action(`${name} ${next}`, `next ${noun} >`),
        ],
      };
      return { lines: [title, blank(), ...catalog.details(item)] };
    },
  };
};
