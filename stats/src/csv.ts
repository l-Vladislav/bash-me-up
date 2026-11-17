/** Events as a CSV file for a spreadsheet. */

/** One field of a CSV row, quoted when it has to be. */
const csvField = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  // A leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (
  columns: readonly string[],
  rows: readonly Record<string, unknown>[],
): string =>
  [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((cells) => cells.map(csvField).join(','))
    .join('\r\n');
