import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { line, toPlainText } from './line';
import type { Line } from './line';
import { LinePrinter } from './printer';

const INTERVAL = 10;

const setup = () => {
  const printed: string[] = [];
  const busy: boolean[] = [];
  const printer = new LinePrinter(
    (lines: Line[]) => printed.push(...lines.map(toPlainText)),
    (state) => busy.push(state),
    INTERVAL,
  );
  return { printer, printed, busy };
};

describe('LinePrinter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('prints one line per interval and reports when it is busy', () => {
    const { printer, printed, busy } = setup();
    printer.print([line('a'), line('b')]);

    expect(printed).toEqual([]);
    expect(busy).toEqual([true]);

    vi.advanceTimersByTime(INTERVAL);
    expect(printed).toEqual(['a']);

    vi.advanceTimersByTime(INTERVAL);
    expect(printed).toEqual(['a', 'b']);
    expect(busy).toEqual([true, false]);
  });

  it('honours a per-line delay', () => {
    const { printer, printed } = setup();
    printer.print([{ ...line('slow'), delay: 500 }]);

    vi.advanceTimersByTime(499);
    expect(printed).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(printed).toEqual(['slow']);
  });

  it('flush prints the rest at once', () => {
    const { printer, printed, busy } = setup();
    printer.print([line('a'), line('b'), line('c')]);
    vi.advanceTimersByTime(INTERVAL);

    printer.flush();
    expect(printed).toEqual(['a', 'b', 'c']);
    expect(busy).toEqual([true, false]);

    vi.runAllTimers();
    expect(printed).toHaveLength(3);
  });

  it('dispose drops whatever is still queued', () => {
    const { printer, printed } = setup();
    printer.print([line('a')]);
    printer.dispose();

    vi.runAllTimers();
    expect(printed).toEqual([]);
  });
});
