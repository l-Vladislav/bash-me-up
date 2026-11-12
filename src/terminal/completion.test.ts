import { describe, expect, it } from 'vitest';
import { complete } from './completion';

describe('complete', () => {
  it('finishes an unambiguous command and adds a space', () => {
    expect(complete('ab')).toBe('about ');
    expect(complete('sk')).toBe('skills ');
  });

  it('extends to the common prefix when several commands match', () => {
    // "clear", "contact", "crt" and "cat" share only the "c".
    expect(complete('c')).toBe('c');
    expect(complete('cl')).toBe('clear ');
  });

  it('completes the first argument from the command options', () => {
    expect(complete('theme g')).toBe('theme green');
    expect(complete('crt o')).toBe('crt o');
    expect(complete('cat ab')).toBe('cat about.txt');
  });

  it('leaves input alone when nothing matches', () => {
    expect(complete('zzz')).toBe('zzz');
    expect(complete('theme x')).toBe('theme x');
    expect(complete('about extra')).toBe('about extra');
  });
});
