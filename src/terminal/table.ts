import { dim } from './line';
import type { Line, Span } from './line';

export interface Column {
  /** Dimmed cells read as secondary information. */
  dim?: boolean;
  /** Right-aligned, for numbers. */
  right?: boolean;
  hideBelow?: Span['hideBelow'];
}

/**
 * Rows of aligned columns that never wrap. The first row is a dimmed header
 * unless `header` is false; the last column is left unpadded.
 */
export const table = (
  rows: readonly (readonly string[])[],
  columns: readonly Column[] = [],
  header = true,
): Line[] => {
  const widths = (rows[0] ?? []).map((_, at) =>
    Math.max(...rows.map((row) => (row[at] ?? '').length)),
  );
  return rows.map((row, index) => ({
    spans: row.map((cell, at): Span => {
      const { dim: tone = false, right = false, hideBelow } = columns[at] ?? {};
      const width = widths[at] ?? 0;
      const fitted = right ? cell.padStart(width) : cell.padEnd(width);
      const text = at === row.length - 1 && !right ? cell : `${fitted}   `;
      const span: Span = (header && index === 0) || tone ? dim(text) : { text };
      return hideBelow ? { ...span, hideBelow } : span;
    }),
    nowrap: true,
  }));
};
