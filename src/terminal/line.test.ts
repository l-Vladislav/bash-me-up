import { describe, expect, it } from 'vitest';
import { animated, later, line, playtime, toPlainText } from './line';

describe('animated', () => {
  const still = [line('one'), line('two')];
  const scenes = [
    { lines: [line('a'), line('b')], ms: 100 },
    { lines: [line('c'), line('d')], ms: 50 },
  ];

  it('gives every row the frames of its own row, and leaves what it settles on alone', () => {
    const [first, second] = animated(still, scenes);
    expect(first?.frames).toEqual([
      { spans: [{ text: 'a' }], ms: 100 },
      { spans: [{ text: 'c' }], ms: 50 },
    ]);
    expect(second?.frames?.map(({ spans }) => spans[0]?.text)).toEqual(['b', 'd']);
    expect(animated(still, scenes).map(toPlainText)).toEqual(['one', 'two']);
  });

  it('leaves rows without scenes as they are', () => {
    expect(animated(still, [])).toEqual(still);
  });
});

describe('later', () => {
  it('keeps rows blank first, ahead of any animation of their own', () => {
    const [row] = later(300, animated([line('end')], [{ lines: [line('mid')], ms: 100 }]));
    expect(row?.frames).toEqual([
      { spans: [], ms: 300 },
      { spans: [{ text: 'mid' }], ms: 100 },
    ]);
    expect(row && playtime(row)).toBe(400);
    expect(row && toPlainText(row)).toBe('end');
  });

  it('does nothing without a wait', () => {
    expect(later(0, [line('now')])).toEqual([line('now')]);
    expect(playtime(line('now'))).toBe(0);
  });
});
