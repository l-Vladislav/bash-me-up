import { describe, expect, it } from 'vitest';
import { toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute } from '../index';
import type { CommandContext } from '../types';
import {
  columnWidth,
  contrastRatio,
  fluidClamp,
  parseColor,
  parseHex,
  parseLength,
  reduceRatio,
  toHex,
  toHsl,
  typeScale,
} from './design';

const context: CommandContext = {
  settings: DEFAULT_SETTINGS,
  history: [],
  random: () => 0,
  now: 0,
  bootedAt: 0,
};

const output = (input: string): string => execute(input, context).lines.map(toPlainText).join('\n');

describe('rem', () => {
  it('reads px, rem and bare numbers', () => {
    expect(parseLength('24')).toEqual({ value: 24, unit: 'px' });
    expect(parseLength('1.5rem')).toEqual({ value: 1.5, unit: 'rem' });
    expect(parseLength('.5em')).toEqual({ value: 0.5, unit: 'rem' });
    expect(parseLength('wide')).toBeUndefined();
  });

  it('converts both ways, against any root size', () => {
    expect(output('rem 24')).toBe('24px = 1.5rem   root 16px');
    expect(output('rem 1.5rem 18')).toBe('1.5rem = 27px   root 18px');
    expect(output('rem')).toContain('usage: rem');
  });
});

describe('scale', () => {
  it('multiplies by the ratio for every step', () => {
    const sizes = Object.fromEntries(typeScale(16, 1.25).map(({ token, px }) => [token, px]));
    expect(sizes.xs).toBeCloseTo(10.24);
    expect(sizes.sm).toBeCloseTo(12.8);
    expect(sizes.base).toBe(16);
    expect(sizes.xl).toBeCloseTo(25);
  });

  it('accepts named ratios and rejects ones that do not grow', () => {
    expect(output('scale 16 major-third')).toContain('(major-third)');
    expect(output('scale 16 major-third')).toContain('2xl');
    expect(output('scale 16 0.9')).toContain('usage: scale');
  });
});

describe('fluid', () => {
  it('builds a clamp() that hits both ends exactly', () => {
    expect(fluidClamp({ min: 16, max: 24, from: 320, to: 1280 })).toBe(
      'clamp(1rem, 0.8333vw + 0.8333rem, 1.5rem)',
    );
  });

  it('keeps the smaller bound first when the size shrinks', () => {
    expect(fluidClamp({ min: 24, max: 16, from: 320, to: 1280 })).toBe(
      'clamp(1rem, -0.8333vw + 1.6667rem, 1.5rem)',
    );
  });

  it('defaults to 320-1280px and reads rem', () => {
    expect(output('fluid 1rem 1.5rem')).toContain('clamp(1rem, 0.8333vw + 0.8333rem, 1.5rem)');
    expect(output('fluid 16 24 800 400')).toContain('usage: fluid');
  });
});

describe('colour', () => {
  it('parses short and long hex, and rgb channels', () => {
    expect(parseHex('#fb0')).toEqual([255, 187, 0]);
    expect(parseHex('FFB000')).toEqual([255, 176, 0]);
    expect(parseHex('#12345')).toBeUndefined();
    expect(parseColor(['255,', '176,', '0'])).toEqual([255, 176, 0]);
    expect(parseColor(['256', '0', '0'])).toBeUndefined();
  });

  it('converts to hex and hsl', () => {
    expect(toHex([255, 176, 0])).toBe('#ffb000');
    expect(toHsl([255, 0, 0])).toEqual([0, 100, 50]);
    expect(toHsl([0, 0, 255])).toEqual([240, 100, 50]);
    expect(toHsl([128, 128, 128])).toEqual([0, 0, 50]);
    expect(output('color #ffb000')).toContain('hsl(41 100% 50%)');
  });

  it('measures contrast the WCAG way', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // #777 on white is the classic near miss: 4.478, shown as 4.47, so normal text fails AA.
    const report = output('contrast #777 #fff');
    expect(report).toContain('4.47:1');
    expect(report).toMatch(/AA {2}normal text +4\.5:1 +fail/);
    expect(report).toMatch(/AA {2}large text +3:1 +pass/);
  });
});

describe('grid', () => {
  const layout = { width: 1280, columns: 12, gutter: 24, margin: 32 };

  it('splits the width between columns and gutters', () => {
    expect(columnWidth(layout)).toBeCloseTo(79.333, 3);
    expect(columnWidth(layout, 12)).toBeCloseTo(1216);
    expect(columnWidth(layout, 6)).toBeCloseTo(596);
  });

  it('refuses a grid with no room for columns', () => {
    expect(output('grid 100 12 24')).toContain('no room');
    expect(output('grid 1280 12')).toContain('usage: grid');
  });
});

describe('aspect', () => {
  it('reduces a size to its ratio', () => {
    expect(reduceRatio(1920, 1080)).toBe('16:9');
    expect(output('aspect 1080 1350')).toContain('4:5');
  });

  it('finds the other side from a ratio', () => {
    expect(output('aspect 16:9 1280')).toContain('1280 x 720');
    expect(output('aspect 4/3 1000')).toContain('1000 x 750');
  });
});

describe('tools section', () => {
  it('lists the design tools in a group of their own', () => {
    const page = output('help tools');
    expect(page).toContain('DESIGN SYSTEM');
    expect(page).toContain('UTILITIES');
    expect(page.indexOf('contrast')).toBeLessThan(page.indexOf('calc'));
  });
});
