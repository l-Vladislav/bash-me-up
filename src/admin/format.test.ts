import { describe, expect, it } from 'vitest';
import { fillDays, formatWhen, place } from './format';

const NOW = Date.UTC(2026, 10, 17, 12);

describe('fillDays', () => {
  it('gives every day of the period, oldest first, with zeroes for empty days', () => {
    const days = fillDays([{ day: '2026-11-16', views: 5, visitors: 3 }], 3, NOW);
    expect(days).toEqual([
      { day: '2026-11-15', views: 0, visitors: 0 },
      { day: '2026-11-16', views: 5, visitors: 3 },
      { day: '2026-11-17', views: 0, visitors: 0 },
    ]);
  });
});

describe('formatWhen', () => {
  it('says how long ago for the last hour', () => {
    expect(formatWhen(NOW - 10_000, NOW)).toBe('только что');
    expect(formatWhen(NOW - 5 * 60_000, NOW)).toBe('5 мин');
  });
});

describe('place', () => {
  it('puts the flag before the city and country', () => {
    expect(place({ country: 'NO', city: 'Oslo' })).toBe('🇳🇴 Oslo, NO');
    expect(place({ country: null, city: null })).toBe('—');
  });
});
