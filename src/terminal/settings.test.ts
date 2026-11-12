import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('restores valid settings', () => {
    expect(parseSettings('{"phosphor":"green","crt":false}')).toEqual({
      phosphor: 'green',
      crt: false,
    });
  });

  it('ignores corrupt or unknown values field by field', () => {
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"phosphor":"purple","crt":false}')).toEqual({
      phosphor: DEFAULT_SETTINGS.phosphor,
      crt: false,
    });
  });
});
