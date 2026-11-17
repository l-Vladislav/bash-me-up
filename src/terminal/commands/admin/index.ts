/**
 * Root access: `sudo` asks for the admin password, and then the visit counter
 * can be read from the terminal itself. The commands stay pure: they return a
 * `remote` effect, the shell asks the API, and `present` turns the answer into
 * lines. Anyone who is not signed in sees none of the root commands.
 */
import type {
  DayCount,
  Feed,
  Health,
  Overview,
  Top,
  TopKey,
  VisitEvent,
  VisitorStory,
} from '../../../../stats/src/types';
import { TOP_KEYS } from '../../../../stats/src/types';
import { terminal } from '../../../content/resume';
import { action, blank, bright, dim, heading, line } from '../../line';
import type { Line, Span } from '../../line';
import { table } from '../../table';
import type { Command, CommandResult, Effect, Session, SessionStep } from '../types';
import type { RemoteReply, RemoteRequest, VisitFilter } from './remote';

const DAY = 86_400_000;

/* ---- Periods -------------------------------------------------------------- */

const PERIODS = { today: 1, '7d': 7, '30d': 30, '90d': 90, year: 365 } as const;
type PeriodName = keyof typeof PERIODS;
const PERIOD_NAMES = Object.keys(PERIODS) as PeriodName[];

/** `7d`, `30`, `year`, ... as a number of days; null for anything else. */
export const parsePeriod = (text: string | undefined, fallback: number): number | null => {
  if (text === undefined) return fallback;
  const key = text.toLowerCase();
  if (key in PERIODS) return PERIODS[key as PeriodName];
  const days = Number(key.replace(/d$/, ''));
  return Object.values(PERIODS).find((value) => value === days) ?? null;
};

const periodName = (days: number): PeriodName =>
  PERIOD_NAMES.find((name) => PERIODS[name] === days) ?? '7d';

const periodTitle = (days: number): string =>
  days === 1 ? 'today' : days === 365 ? 'the last year' : `the last ${days} days`;

/** `today 7d 30d 90d year`, the current one lit, the others clickable. */
const periodSwitch = (command: string, days: number): Span[] =>
  PERIOD_NAMES.flatMap((name) => [
    { text: ' ' },
    PERIODS[name] === days
      ? { text: name, tone: 'inverse' as const }
      : action(`${command} ${name}`, name),
  ]);

/* ---- Formatting ----------------------------------------------------------- */

const count = (value: number): string => value.toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (value: number): string => String(value).padStart(2, '0');

/** `14:02` today, `12 Nov 14:02` before; local time. */
export const clock = (at: number, now: number): string => {
  const date = new Date(at);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return date.toDateString() === new Date(now).toDateString()
    ? time
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${time}`;
};

const dayLabel = (day: string): string => {
  const [, month = '1', date = '1'] = day.split('-');
  return `${Number(date)} ${MONTHS[Number(month) - 1]}`;
};

const ago = (at: number, now: number): string => {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
};

const place = (event: Pick<VisitEvent, 'city' | 'country'>): string =>
  [event.city, event.country].filter(Boolean).join(', ') || '?';

const short = (visitor: string): string => visitor.slice(0, 6);

const title = (text: string, ...rest: Span[]): Line => ({
  spans: [...heading(text).spans, ...rest],
});

/* ---- Daily chart ---------------------------------------------------------- */

/** Every day of the period, oldest first, zeroes where nobody came. */
export const everyDay = (daily: readonly DayCount[], days: number, now: number): DayCount[] => {
  const known = new Map(daily.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now - (days - 1 - index) * DAY).toISOString().slice(0, 10);
    return known.get(day) ?? { day, views: 0, visitors: 0 };
  });
};

const CHART_HEIGHT = 5;
const CHART_COLUMNS = 31;

/**
 * Visitors a day as ASCII columns. A long period is cut into steps of several
 * days, each column the average day of its step.
 */
export const chart = (days: readonly DayCount[]): Line[] => {
  const step = Math.ceil(days.length / CHART_COLUMNS);
  const buckets: { day: string; value: number }[] = [];
  for (let start = 0; start < days.length; start += step) {
    const slice = days.slice(start, start + step);
    const total = slice.reduce((sum, row) => sum + row.visitors, 0);
    buckets.push({ day: slice[0]?.day ?? '', value: total / slice.length });
  }
  const peak = Math.max(1, ...buckets.map(({ value }) => value));
  // A week gets wide columns; a month packs them solid, so the chart fits a
  // phone, where ASCII art shrinks to about 56 characters.
  const width = buckets.length <= 10 ? 2 : 1;
  const gap = buckets.length <= 13 ? ' ' : '';
  const gutter = String(Math.round(peak)).length + 1;

  const rows = Array.from({ length: CHART_HEIGHT }, (_, index) => {
    const level = CHART_HEIGHT - index;
    const bars = buckets
      .map(({ value }) => {
        const height = (value / peak) * CHART_HEIGHT;
        const cell = height >= level - 0.25 ? '#' : value > 0 && level === 1 ? '.' : ' ';
        return cell.repeat(width);
      })
      .join(gap);
    const label = index === 0 ? String(Math.round(peak)) : index === CHART_HEIGHT - 1 ? '0' : '';
    return `${label.padStart(gutter - 1)} | ${bars}`;
  });
  const span = buckets.length * (width + gap.length) - gap.length;
  const first = dayLabel(buckets[0]?.day ?? '');
  const last = dayLabel(buckets.at(-1)?.day ?? '');
  const axis = `${' '.repeat(gutter + 2)}${first}${last.padStart(Math.max(1, span - first.length))}`;
  return [...rows, axis].map((row) => ({ spans: [{ text: row }], art: true }));
};

/* ---- Pages ---------------------------------------------------------------- */

const TOP_TITLES: Record<TopKey, string> = {
  countries: 'countries',
  cities: 'cities',
  referrers: 'came from',
  networks: 'networks',
  pages: 'landed on',
  commands: 'commands',
  devices: 'devices',
  browsers: 'browsers',
  languages: 'languages',
};

const TOP_SHORT = 3;

const topLine = (key: TopKey, rows: readonly Top[], days: number, width: number): Line => ({
  spans: [
    { text: '  ' },
    action(`top ${key} ${periodName(days)}`, TOP_TITLES[key]),
    { text: ' '.repeat(width - TOP_TITLES[key].length) },
    rows.length === 0
      ? dim('nothing yet')
      : {
          text: rows
            .slice(0, TOP_SHORT)
            // `desktop · macOS` would read as two entries here.
            .map((row) => `${row.label.replaceAll(' · ', ' ')} ${count(row.visitors)}`)
            .join(' · '),
        },
  ],
  hang: width + 2,
});

const SUMMARY_TOPS: TopKey[] = ['countries', 'referrers', 'pages', 'commands', 'devices'];

export const statsPage = (overview: Overview, now: number): Line[] => {
  const { days, totals, today, online, tops } = overview;
  const width = Math.max(...SUMMARY_TOPS.map((key) => TOP_TITLES[key].length)) + 2;
  return [
    title('stats', { text: '  ' }, ...periodSwitch('stats', days)),
    blank(),
    line('  on the site now  ', bright(count(online)), dim('   (seen in the last 5 minutes)')),
    line(
      '  today            ',
      bright(count(today.visitors)),
      ` visitors, ${count(today.views)} views`,
    ),
    blank(),
    line(dim(`  ${periodTitle(days)}:`)),
    line(
      '  ',
      bright(count(totals.visitors)),
      ` visitors (${count(totals.newVisitors)} new) · `,
      bright(count(totals.views)),
      ' views · ',
      bright(count(totals.commands)),
      ' commands · ',
      bright(count(totals.countries)),
      ' countries',
    ),
    ...(days > 1
      ? [
          blank(),
          line(dim(days > CHART_COLUMNS ? '  visitors a day, averaged' : '  visitors a day')),
          ...chart(everyDay(overview.daily, days, now)),
        ]
      : []),
    blank(),
    ...SUMMARY_TOPS.map((key) => topLine(key, tops[key], days, width)),
    blank(),
    line(
      dim('  more: '),
      action('visits'),
      dim(' · '),
      action(`top cities ${periodName(days)}`, 'top <list>'),
      dim(' · '),
      action('db'),
    ),
  ];
};

const BAR = 16;

export const topPage = (overview: Overview, list: TopKey): Line[] => {
  const rows = overview.tops[list];
  const peak = Math.max(1, ...rows.map((row) => row.visitors));
  const hits = list === 'commands' ? 'runs' : 'views';
  return [
    title(`top ${list}`, { text: '  ' }, ...periodSwitch(`top ${list}`, overview.days)),
    blank(),
    ...(rows.length === 0
      ? [line(dim(`  nothing in ${periodTitle(overview.days)}`))]
      : table(
          [
            ['  #', TOP_TITLES[list], 'visitors', hits, ''],
            ...rows.map((row, index) => [
              `${index + 1}`.padStart(3),
              row.label,
              count(row.visitors),
              count(row.hits),
              '='.repeat(Math.max(1, Math.round((row.visitors / peak) * BAR))),
            ]),
          ],
          [{ dim: true }, {}, { right: true }, { right: true, dim: true }, { hideBelow: 'medium' }],
        )),
    blank(),
    line(
      dim('  lists: '),
      ...TOP_KEYS.flatMap((key, index) => [
        ...(index > 0 ? [dim(' ')] : []),
        key === list
          ? { text: key, tone: 'inverse' as const }
          : action(`top ${key} ${periodName(overview.days)}`, key),
      ]),
    ),
  ];
};

/** One event as a clickable row: when, what, where; the click opens its visitor. */
const eventRow = (event: VisitEvent, now: number, withVisitor: boolean): Line => {
  const what = event.type === 'command' ? `$ ${event.name}` : `> ${event.name}`;
  const details =
    event.type === 'view'
      ? [
          place(event),
          event.referrer ?? 'direct',
          [event.device, event.os].filter(Boolean).join(' '),
        ]
      : [place(event)];
  return {
    spans: [
      dim(`  ${clock(event.at, now).padStart(12)}  `),
      event.type === 'view' ? bright(what.padEnd(16)) : { text: what.padEnd(16) },
      ...(withVisitor
        ? [action(`visitor ${short(event.visitor)}`, `#${short(event.visitor)}`), { text: '  ' }]
        : []),
      { ...dim(details.join(' · ')), breakBelow: 'medium' },
    ],
    hang: 16,
    ...(withVisitor && { command: `visitor ${short(event.visitor)}` }),
  };
};

const FEED_ROWS = 25;
const FILTERS: VisitFilter[] = ['all', 'views', 'commands'];

export const visitsPage = (feed: Feed, filter: VisitFilter, now: number): Line[] => [
  title(
    'visits',
    { text: '  ' },
    ...FILTERS.flatMap((name) => [
      { text: ' ' },
      name === filter ? { text: name, tone: 'inverse' as const } : action(`visits ${name}`, name),
    ]),
  ),
  blank(),
  ...(feed.events.length === 0
    ? [line(dim('  nobody yet'))]
    : feed.events.slice(0, FEED_ROWS).map((event) => eventRow(event, now, true))),
  blank(),
  line(dim('  newest first; pick a row to see everything that visitor did')),
];

const STORY_ROWS = 40;

export const visitorPage = (story: VisitorStory, now: number): Line[] => {
  const latest = story.events.find((event) => event.type === 'view') ?? story.events[0];
  const facts: [string, string][] = [
    ['first seen', `${clock(story.first, now)} (${ago(story.first, now)})`],
    ['last seen', `${clock(story.last, now)} (${ago(story.last, now)})`],
    ['days', count(story.days)],
    ['views', `${count(story.views)}, commands ${count(story.commands)}`],
    ...(latest
      ? ([
          ['from', [place(latest), latest.network].filter(Boolean).join(' · ')],
          [
            'device',
            [latest.device, latest.os, latest.browser, latest.screen, latest.lang]
              .filter(Boolean)
              .join(' · '),
          ],
        ] as [string, string][])
      : []),
  ];
  return [
    title(`visitor #${short(story.visitor)}`, { text: '   ' }, action('visits', '< visits')),
    blank(),
    ...facts.map(([label, value]) => ({ ...line(dim(`  ${label.padEnd(12)}`), value), hang: 14 })),
    blank(),
    ...story.events.slice(0, STORY_ROWS).map((event) => eventRow(event, now, false)),
    ...(story.events.length > STORY_ROWS
      ? [line(dim(`  ...and ${story.events.length - STORY_ROWS} earlier`))]
      : []),
  ];
};

const bytes = (size: number): string =>
  size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

export const dbPage = (health: Health, now: number): Line[] => [
  title('db'),
  blank(),
  ...table(
    [
      ['  events', count(health.events)],
      ['  size', bytes(health.bytes)],
      [
        '  oldest',
        health.oldest ? `${clock(health.oldest, now)} (${ago(health.oldest, now)})` : '-',
      ],
      [
        '  newest',
        health.newest ? `${clock(health.newest, now)} (${ago(health.newest, now)})` : '-',
      ],
      ['  kept', `${health.retentionDays} days, older ones deleted nightly`],
    ],
    [{ dim: true }],
    false,
  ),
];

/* ---- Answers -------------------------------------------------------------- */

const ATTEMPTS = 3;

const passwordPrompt = (attempt: number): Session => ({
  prompt: `[sudo] password for ${terminal.user}:`,
  secret: true,
  input: (password): SessionStep =>
    password
      ? { lines: [], effects: [{ type: 'remote', request: { kind: 'login', password, attempt } }] }
      : wrongPassword(attempt),
});

const wrongPassword = (attempt: number): CommandResult =>
  attempt < ATTEMPTS
    ? { lines: [line('Sorry, try again.')], session: passwordPrompt(attempt + 1) }
    : {
        lines: [
          line(`sudo: ${ATTEMPTS} incorrect password attempts`),
          line(dim('This incident will be reported.')),
        ],
      };

const NAMES: Record<RemoteRequest['kind'], string> = {
  login: 'sudo',
  stats: 'stats',
  top: 'top',
  visits: 'visits',
  visitor: 'visitor',
  db: 'db',
  export: 'export',
};

/** What the shell prints once the API has answered `request`. */
export const present = (request: RemoteRequest, reply: RemoteReply, now: number): CommandResult => {
  const name = NAMES[request.kind];
  if (!reply.ok) {
    switch (reply.failure) {
      case 'wrong':
        return request.kind === 'login' ? wrongPassword(request.attempt) : { lines: [] };
      case 'throttled':
        return { lines: [line(`${name}: too many attempts; wait a minute`)] };
      case 'offline':
        return { lines: [line(`${name}: cannot reach the server`)] };
      case 'unconfigured':
        return { lines: [line(`${name}: this build has no server to ask (VITE_STATS_URL)`)] };
      case 'signed-out':
        return {
          lines: [line(`${name}: session expired. Type `, action('sudo'), ' to sign in again.')],
        };
      case 'not-found':
        return { lines: [line(`${name}: no such visitor`)] };
      case 'failed':
        return { lines: [line(`${name}: the server failed; try again later`)] };
    }
  }

  switch (request.kind) {
    case 'login':
      return {
        lines: [
          line(
            bright('Access granted.'),
            ' You are root now; visits from this browser no longer count.',
          ),
          line(
            'Type ',
            action('admin'),
            ' for the root commands, ',
            action('logout'),
            ' to leave.',
          ),
          line(dim('Root lasts until the page reloads; then sudo asks again.')),
        ],
      };
    case 'stats':
      return { lines: statsPage(reply.data as Overview, now) };
    case 'top':
      return { lines: topPage(reply.data as Overview, request.list) };
    case 'visits':
      return { lines: visitsPage(reply.data as Feed, request.filter, now) };
    case 'visitor':
      return { lines: visitorPage(reply.data as VisitorStory, now) };
    case 'db':
      return { lines: dbPage(reply.data as Health, now) };
    case 'export':
      return { lines: [line('Saved ', bright(String(reply.data)), '.')] };
  }
};

/* ---- Commands ------------------------------------------------------------- */

const remote = (request: RemoteRequest): CommandResult => ({
  lines: [],
  effects: [{ type: 'remote', request }],
});

const usage = (text: string): CommandResult => ({ lines: [line(`usage: ${text}`)] });

export const sudo: Command = {
  name: 'sudo',
  summary: 'Become root (the site admin)',
  hidden: true,
  run: (_args, { root }) =>
    root
      ? { lines: [line('You are root already. Type ', action('admin'), ' for the root commands.')] }
      : { lines: [], session: passwordPrompt(1) },
};

const stats: Command = {
  name: 'stats',
  summary: 'Visitors: now, today, the period, the daily curve, top lists',
  usage: `[${PERIOD_NAMES.join('|')}]`,
  options: PERIOD_NAMES,
  root: true,
  run: ([period]) => {
    const days = parsePeriod(period, 7);
    return days === null
      ? usage(`stats [${PERIOD_NAMES.join('|')}]`)
      : remote({ kind: 'stats', days });
  },
};

const top: Command = {
  name: 'top',
  summary: 'One full top list: countries, cities, commands...',
  usage: '<list> [period]',
  options: TOP_KEYS,
  root: true,
  run: ([list, period]) => {
    const key = TOP_KEYS.find((candidate) => candidate === list?.toLowerCase());
    const days = parsePeriod(period, 30);
    if (!key || days === null)
      return usage(`top <${TOP_KEYS.join('|')}> [${PERIOD_NAMES.join('|')}]`);
    return remote({ kind: 'top', list: key, days });
  },
};

const visits: Command = {
  name: 'visits',
  summary: 'The latest views and commands, newest first',
  usage: `[${FILTERS.join('|')}]`,
  options: FILTERS,
  root: true,
  run: ([filter = 'all']) => {
    const chosen = FILTERS.find((candidate) => candidate === filter.toLowerCase());
    return chosen
      ? remote({ kind: 'visits', filter: chosen })
      : usage(`visits [${FILTERS.join('|')}]`);
  },
};

const visitor: Command = {
  name: 'visitor',
  summary: 'Everything one visitor did',
  usage: '<id>',
  root: true,
  run: ([id = '']) => {
    const clean = id.replace(/^#/, '').toLowerCase();
    return /^[0-9a-f]{4,16}$/.test(clean)
      ? remote({ kind: 'visitor', id: clean })
      : usage('visitor <id>   (the #tag from `visits`)');
  },
};

const db: Command = {
  name: 'db',
  summary: 'Size and span of the visits database',
  root: true,
  run: () => remote({ kind: 'db' }),
};

const exportCsv: Command = {
  name: 'export',
  summary: 'Download the events as CSV',
  usage: `[${PERIOD_NAMES.join('|')}]`,
  options: PERIOD_NAMES,
  root: true,
  run: ([period]) => {
    const days = parsePeriod(period, 30);
    return days === null
      ? usage(`export [${PERIOD_NAMES.join('|')}]`)
      : remote({ kind: 'export', days });
  },
};

const COUNT_MODES = ['on', 'off'] as const;

const countme: Command = {
  name: 'countme',
  summary: 'Count visits from this browser, or not',
  usage: '[on|off]',
  options: COUNT_MODES,
  root: true,
  run: ([mode], { owner = false }) => {
    if (mode === undefined) {
      return {
        lines: [
          line(
            'Visits from this browser ',
            bright(owner ? 'are not counted' : 'are counted'),
            '. Change: ',
            action(owner ? 'countme on' : 'countme off'),
          ),
        ],
      };
    }
    if (mode !== 'on' && mode !== 'off') return usage('countme [on|off]');
    const effect: Effect = { type: 'set-owner', owner: mode === 'off' };
    return {
      lines: [
        line('Visits from this browser ', bright(mode === 'on' ? 'count' : 'no longer count'), '.'),
      ],
      effects: [effect],
    };
  },
};

/** Leaving root: `logout`, or `exit` while root. */
export const signOutResult = (): CommandResult => ({
  lines: [line('logout'), line(dim('Back to guest.'))],
  effects: [{ type: 'sign-out' }],
});

const logout: Command = {
  name: 'logout',
  summary: 'Stop being root',
  root: true,
  run: () => signOutResult(),
};

/** Listed by `admin` (and `help admin`) for the signed-in admin. */
export const rootCommands: readonly Command[] = [
  stats,
  visits,
  visitor,
  top,
  db,
  exportCsv,
  countme,
  logout,
];
