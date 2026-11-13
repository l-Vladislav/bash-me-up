import { action, blank, dim, heading, line } from '../line';
import type { Line, Span } from '../line';
import type { Command, CommandResult } from './types';

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
  /** The command that opens it, with any arguments before the item number, e.g. `gallery portraits`. */
  name: string;
  /** Shown as the page title and in `< all ...`; the name by default. */
  title?: string;
  /** A command one level up, linked from the title row of the list, e.g. `gallery`. */
  parent?: string;
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

  // On a phone the columns that drop out move to a second line under the label.
  const folded = columns.filter((column) => column.hideBelow);

  const rows = items.map((item, index): Line => {
    const command = `${name} ${index + 1}`;
    const text = label.value(item);
    // Ranges such as `01/2025 - present` wrap as a whole, never at the dash.
    const details = folded.map((column) => column.value(item).replaceAll(' - ', ' - ')).join(' · ');
    return {
      spans: [
        dim(`[${index + 1}]`.padEnd(indexWidth)),
        action(command, text),
        { text: ' '.repeat(labelWidth - text.length) },
        ...columns.map((column, at) => cell(column, at, column.value(item), column.dim ?? false)),
        ...(details ? [{ ...dim(details), showBelow: 'medium' as const, indent: indexWidth }] : []),
      ],
      nowrap: true,
      command,
    };
  });

  return [header, ...rows];
};

const article = (noun: string): string => (/^[aeiou]/i.test(noun) ? 'an' : 'a');

/** The table, or with a number the page of that item: what `<name> [n]` prints. */
export const openCatalog = <T>(catalog: Catalog<T>, selector?: string): CommandResult => {
  const { name, noun, items, parent } = catalog;
  const title = catalog.title ?? name;
  const range = `1-${items.length}`;

  if (selector === undefined) {
    // The way up shares the title row, as the item pages' navigation does.
    const top: Line = parent
      ? { spans: [...heading(title).spans, { text: '   ' }, action(parent, `< ${parent}`)] }
      : heading(title);
    return {
      lines: [
        top,
        blank(),
        ...table(catalog),
        blank(),
        line(
          dim(`Select ${article(noun)} ${noun} or type \`${name} <n>\`, e.g. `),
          action(`${name} 1`),
        ),
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
  const titleRow: Line = {
    spans: [
      ...heading(`${noun} ${index + 1}/${items.length}`).spans,
      { text: '   ' },
      action(name, `< all ${title}`),
      { text: '   ' },
      action(`${name} ${next}`, `next ${noun} >`),
    ],
  };
  return { lines: [titleRow, blank(), ...catalog.details(item)] };
};

export const catalogCommand = <T>(catalog: Catalog<T>): Command => ({
  name: catalog.name,
  summary: catalog.summary,
  usage: `[1-${catalog.items.length}]`,
  options: catalog.items.map((_, index) => String(index + 1)),
  run: ([selector]) => openCatalog(catalog, selector),
});
