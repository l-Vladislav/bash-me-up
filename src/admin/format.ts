import type { DayCount, VisitEvent } from '../../stats/src/types';
import { flag } from '../../stats/src/visit';

const DAY = 86_400_000;

const number = new Intl.NumberFormat('ru-RU');
export const formatNumber = (value: number): string => number.format(value);

export const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${formatNumber(Math.round(bytes / 1024))} КБ`
    : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`;

const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
export const formatDateTime = (at: number): string => dateTime.format(at);

const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

/** "только что", "5 мин", "14:02" today, "12 нояб. 14:02" before. */
export const formatWhen = (at: number, now: number): string => {
  const ago = now - at;
  if (ago < 60_000) return 'только что';
  if (ago < 3_600_000) return `${Math.floor(ago / 60_000)} мин`;
  if (new Date(at).toDateString() === new Date(now).toDateString()) return time.format(at);
  return `${shortDate.format(at)} ${time.format(at)}`;
};

/** `2026-11-17` as "17 нояб.", read as a UTC day. */
export const formatDay = (day: string): string => shortDate.format(new Date(`${day}T12:00:00Z`));

/**
 * Every day of the period, oldest first, with zeroes for days nobody came:
 * the server leaves those out, the chart needs them.
 */
export const fillDays = (daily: readonly DayCount[], days: number, now: number): DayCount[] => {
  const known = new Map(daily.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now - (days - 1 - index) * DAY).toISOString().slice(0, 10);
    return known.get(day) ?? { day, views: 0, visitors: 0 };
  });
};

export const place = (event: Pick<VisitEvent, 'country' | 'city'>): string =>
  [flag(event.country), [event.city, event.country].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' ') || '—';

export const countryLabel = (code: string): string => `${flag(code)} ${code}`;

export { flag };
