import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('restores valid settings', () => {
    const stored = { phosphor: 'green', crt: false, brightness: 0.2, contrast: 1 };
    expect(parseSettings(JSON.stringify(stored))).toEqual(stored);
  });

  it('ignores corrupt or unknown values field by field', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"phosphor":"purple","crt":false,"brightness":7}')).toEqual({
      ...DEFAULT_SETTINGS,
      crt: false,
    });
  });
});
