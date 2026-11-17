import { describe, expect, it } from 'vitest';
import type { DayCount, Overview, VisitEvent } from '../../../../stats/src/types';
import { complete } from '../../completion';
import { toPlainText } from '../../line';
import type { Line } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute } from '../index';
import type { CommandContext } from '../index';
import { chart, everyDay, parsePeriod, present, visitsPage } from './index';

const NOW = Date.UTC(2026, 10, 17, 12);

const guest: CommandContext = {
  settings: DEFAULT_SETTINGS,
  history: [],
  random: () => 0,
  now: NOW,
  bootedAt: NOW,
};
const root: CommandContext = { ...guest, root: true };

const text = (lines: readonly Line[]): string => lines.map(toPlainText).join('\n');

const overview: Overview = {
  days: 7,
  online: 2,
  today: { views: 5, visitors: 3 },
  totals: { views: 62, visitors: 36, newVisitors: 24, countries: 5, commands: 154 },
  daily: [
    { day: '2026-11-15', views: 9, visitors: 6 },
    { day: '2026-11-17', views: 5, visitors: 3 },
  ],
  tops: {
    countries: [{ label: 'NO', visitors: 12, hits: 20 }],
    cities: [],
    referrers: [{ label: 'linkedin.com', visitors: 4, hits: 4 }],
    networks: [],
    pages: [],
    commands: [{ label: 'dungeon', visitors: 9, hits: 30 }],
    devices: [],
    browsers: [],
    languages: [],
  },
};

const event = (overrides: Partial<VisitEvent>): VisitEvent => ({
  id: 1,
  at: NOW - 120_000,
  type: 'view',
  name: '/',
  visitor: '0741c7aa00112233',
  country: 'PT',
  region: null,
  city: 'Lisbon',
  network: 'MEO',
  referrer: null,
  device: 'mobile',
  browser: 'Safari',
  os: 'iOS',
  lang: 'en-US',
  screen: '390x844',
  ...overrides,
});

describe('root commands for a guest', () => {
  it('do not exist', () => {
    for (const name of [
      'stats',
      'visits',
      'visitor 0741c7',
      'top countries',
      'db',
      'logout',
      'admin',
    ]) {
      expect(text(execute(name, guest).lines)).toContain('command not found');
    }
  });

  it('are neither listed, completed nor documented', () => {
    expect(text(execute('help', guest).lines)).not.toContain('admin');
    expect(text(execute('help admin', guest).lines)).toContain('no section');
    expect(text(execute('man stats', guest).lines)).toContain('No manual entry');
    expect(complete('stat')).toBe('stat');
    expect(complete('logo')).toBe('logo');
  });
});

describe('sudo', () => {
  it('asks for the password without showing it', () => {
    const { session } = execute('sudo', guest);
    expect(session?.secret).toBe(true);
    expect(session?.prompt).toContain('[sudo] password for');
    expect(session?.input('hunter2').effects).toEqual([
      { type: 'remote', request: { kind: 'login', password: 'hunter2', attempt: 1 } },
    ]);
  });

  it('gives three tries, like the real one', () => {
    const second = present(
      { kind: 'login', password: 'x', attempt: 1 },
      { ok: false, failure: 'wrong' },
      NOW,
    );
    expect(text(second.lines)).toBe('Sorry, try again.');
    expect(second.session?.input('').lines.map(toPlainText)).toEqual(['Sorry, try again.']);

    const last = present(
      { kind: 'login', password: 'x', attempt: 3 },
      { ok: false, failure: 'wrong' },
      NOW,
    );
    expect(text(last.lines)).toContain('3 incorrect password attempts');
    expect(last.session).toBeUndefined();
  });

  it('lets the admin in', () => {
    const result = present(
      { kind: 'login', password: 'x', attempt: 1 },
      { ok: true, data: null },
      NOW,
    );
    expect(text(result.lines)).toContain('Access granted');
  });

  it('knows root already', () => {
    expect(text(execute('sudo', root).lines)).toContain('root already');
  });
});

describe('root commands for the admin', () => {
  const effects = (input: string) => execute(input, root).effects;

  it('ask the API', () => {
    expect(effects('stats')).toEqual([{ type: 'remote', request: { kind: 'stats', days: 7 } }]);
    expect(effects('stats year')).toEqual([
      { type: 'remote', request: { kind: 'stats', days: 365 } },
    ]);
    expect(effects('top cities 90d')).toEqual([
      { type: 'remote', request: { kind: 'top', list: 'cities', days: 90 } },
    ]);
    expect(effects('visits commands')).toEqual([
      { type: 'remote', request: { kind: 'visits', filter: 'commands' } },
    ]);
    expect(effects('visitor #0741C7')).toEqual([
      { type: 'remote', request: { kind: 'visitor', id: '0741c7' } },
    ]);
  });

  it('explain themselves when the arguments are wrong', () => {
    expect(text(execute('stats 12d', root).lines)).toContain('usage: stats');
    expect(text(execute('top planets', root).lines)).toContain('usage: top');
    expect(text(execute('visitor nope', root).lines)).toContain('usage: visitor');
  });

  it('are listed, completed and documented', () => {
    expect(text(execute('help', root).lines)).toContain('admin');
    expect(text(execute('admin', root).lines)).toContain('stats');
    expect(complete('stat', true)).toBe('stats ');
    expect(complete('top cou', true)).toBe('top countries');
  });

  it('switch counting and sign out', () => {
    expect(effects('countme on')).toEqual([{ type: 'set-owner', owner: false }]);
    expect(text(execute('countme', { ...root, owner: true }).lines)).toContain('are not counted');
    expect(effects('logout')).toEqual([{ type: 'sign-out' }]);
    expect(effects('exit')).toEqual([{ type: 'sign-out' }]);
    expect(execute('exit', guest).effects).toBeUndefined();
  });
});

describe('answers', () => {
  it('print the stats with the curve and the top lists', () => {
    const output = text(
      present({ kind: 'stats', days: 7 }, { ok: true, data: overview }, NOW).lines,
    );
    expect(output).toContain('36 visitors (24 new)');
    expect(output).toContain('NO 12');
    expect(output).toContain('dungeon 9');
    expect(output).toContain('|');
  });

  it('make every visit a way to its visitor', () => {
    const lines = visitsPage({ events: [event({})], next: null }, 'all', NOW);
    const row = lines.find((entry) => entry.command);
    expect(row?.command).toBe('visitor 0741c7');
    expect(toPlainText(row as Line)).toContain('Lisbon, PT');
  });

  it('say when the sign-in is gone', () => {
    const result = present({ kind: 'db' }, { ok: false, failure: 'signed-out' }, NOW);
    expect(text(result.lines)).toContain('session expired');
  });
});

describe('parsePeriod', () => {
  it('reads names and numbers', () => {
    expect(parsePeriod(undefined, 7)).toBe(7);
    expect(parsePeriod('today', 7)).toBe(1);
    expect(parsePeriod('30', 7)).toBe(30);
    expect(parsePeriod('90d', 7)).toBe(90);
    expect(parsePeriod('YEAR', 7)).toBe(365);
    expect(parsePeriod('12d', 7)).toBeNull();
  });
});

describe('chart', () => {
  const days = (count: number): DayCount[] =>
    everyDay([{ day: '2026-11-17', views: 4, visitors: 4 }], count, NOW);

  it('draws the peak at full height', () => {
    const rows = chart(days(7)).map(toPlainText);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatch(/^4 \|.*##/);
    expect(rows.at(-1)).toContain('17 Nov');
  });

  it('folds a long period into at most a month of columns', () => {
    const [top = ''] = chart(days(365)).map(toPlainText);
    expect(top.split('|')[1]?.length).toBeLessThanOrEqual(31 * 2);
  });
});
