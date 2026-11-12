import { describe, expect, it } from 'vitest';
import { line } from './line';
import { EMPTY_SCREEN, screenReducer } from './screen';
import type { Entry, Screen } from './screen';

const entry = (id: number, clear = false): Entry => ({ id, line: { ...line(`row ${id}`), clear } });

const ids = (entries: readonly Entry[]): number[] => entries.map(({ id }) => id);

const printed = (...entries: Entry[]): Screen =>
  screenReducer(EMPTY_SCREEN, { type: 'print', entries });

describe('screenReducer', () => {
  it('appends printed entries', () => {
    const screen = screenReducer(printed(entry(1)), { type: 'print', entries: [entry(2)] });
    expect(ids(screen.entries)).toEqual([1, 2]);
    expect(screen.wipes).toBe(0);
  });

  it('wipes to a ghost of the previous picture', () => {
    const screen = screenReducer(printed(entry(1), entry(2)), {
      type: 'wipe',
      trailing: [entry(3)],
    });
    expect(screen.entries).toEqual([]);
    expect(ids(screen.ghost)).toEqual([1, 2, 3]);
    expect(screen.wipes).toBe(1);
  });

  it('treats a form feed as a wipe in the middle of a batch', () => {
    const screen = screenReducer(printed(entry(1)), {
      type: 'print',
      entries: [entry(2), entry(3, true), entry(4)],
    });
    expect(ids(screen.entries)).toEqual([3, 4]);
    expect(ids(screen.ghost)).toEqual([1, 2]);
    expect(screen.wipes).toBe(1);
  });
});
