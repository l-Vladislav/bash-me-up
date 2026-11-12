import { describe, expect, it } from 'vitest';
import { toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute } from '../index';
import type { CommandContext } from '../types';
import { GLYPH_HEIGHT, renderBanner } from './banner';
import { CalcError, evaluate, formatNumber } from './calc';
import { fromMorse, isMorse, toMorse } from './morse';

const context: CommandContext = {
  settings: DEFAULT_SETTINGS,
  history: [],
  random: () => 0,
  now: new Date(2026, 10, 12, 19, 44, 47).getTime(),
  bootedAt: new Date(2026, 10, 12, 18, 30, 0).getTime(),
};

const output = (input: string): string => execute(input, context).lines.map(toPlainText).join('\n');

describe('calc', () => {
  it('follows operator precedence and associativity', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7);
    expect(evaluate('(1 + 2) * 3')).toBe(9);
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512);
    expect(evaluate('-2 ^ 2')).toBe(4);
    expect(evaluate('10 % 4 - -1')).toBe(3);
    expect(evaluate('1.5e3 / .5')).toBe(3000);
  });

  it('knows a few functions and constants', () => {
    expect(evaluate('sqrt(16) + abs(-2)')).toBe(6);
    expect(evaluate('cos(pi)')).toBe(-1);
    expect(evaluate('ln(e)')).toBe(1);
  });

  it('reports malformed input instead of guessing', () => {
    expect(() => evaluate('2 +')).toThrow(CalcError);
    expect(() => evaluate('(1')).toThrow(CalcError);
    expect(() => evaluate('1 2')).toThrow(CalcError);
    expect(() => evaluate('foo(1)')).toThrow('unknown name "foo"');
    expect(() => evaluate('2 $ 3')).toThrow('unexpected "$"');
  });

  it('prints tidy numbers', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 0)).toBe('infinity');
    expect(output('calc 2^10 / 4')).toBe('256');
    expect(output('bc 1/0')).toBe('infinity');
    expect(output('calc 2 +')).toContain('calc: unexpected end');
  });
});

describe('banner', () => {
  it('draws every character the same height', () => {
    const rows = renderBanner('Hello, World 42!?');
    expect(rows).toHaveLength(GLYPH_HEIGHT);
    expect(rows.every((row) => row.length > 0)).toBe(true);
  });

  it('refuses text that would not fit', () => {
    expect(output('banner this is far too long')).toContain('up to 16 characters');
  });
});

describe('morse', () => {
  it('round-trips text', () => {
    expect(toMorse('SOS help')).toBe('... --- ... / .... . .-.. .--.');
    expect(fromMorse(toMorse('sos help'))).toBe('SOS HELP');
  });

  it('decodes when given dots and dashes', () => {
    expect(isMorse('... --- ...')).toBe(true);
    expect(isMorse('sos')).toBe(false);
    expect(output('morse ... --- ...')).toBe('SOS');
  });
});

describe('clock and system tools', () => {
  it('date prints the classic format', () => {
    expect(output('date')).toBe('Thu Nov 12 19:44:47 2026');
  });

  it('cal lays out the month with today highlighted', () => {
    const lines = execute('cal', context).lines;
    const plain = lines.map(toPlainText);
    expect(plain[0]?.trim()).toBe('November 2026');
    expect(plain[2]).toBe(' 1  2  3  4  5  6  7');
    const today = lines.flatMap((line) => line.spans).find((span) => span.tone === 'inverse');
    expect(today?.text).toBe('12');
  });

  it('cal accepts a month and year and rejects nonsense', () => {
    expect(toPlainText(execute('cal 2 2024', context).lines[0] ?? { spans: [] }).trim()).toBe(
      'February 2024',
    );
    expect(output('cal 13')).toContain('not a month');
  });

  it('uptime counts from power-on', () => {
    expect(output('uptime')).toContain('up 1:14, 1 user');
  });

  it('echo, uname and fortune print something sensible', () => {
    expect(output('echo hello   world')).toBe('hello world');
    expect(output('uname')).toBe('VL-42');
    expect(output('fortune').length).toBeGreaterThan(0);
  });

  it('man describes listed commands only', () => {
    expect(output('man calc')).toContain('calc - Evaluate arithmetic');
    expect(output('man calc')).toContain('bc');
    expect(output('man sudo')).toContain('No manual entry');
    expect(output('man')).toBe('What manual page do you want?');
  });
});
