/**
 * Back-of-the-envelope maths for system design interviews: traffic, storage,
 * bandwidth, fleet size and availability, plus the reference tables people
 * are expected to know by heart. The arithmetic is plain exported functions;
 * the commands only parse arguments and lay out lines.
 *
 * Sizes are decimal (1 KB = 1000 B), the usual interview shorthand.
 */
import { bright, dim, line } from '../../line';
import type { Line, Span } from '../../line';
import type { Command } from '../types';

export const SECONDS_PER_DAY = 86_400;
const DAYS_PER_YEAR = 365;

/* ---- Reading and writing numbers ------------------------------------------ */

const COUNT_SUFFIXES: Readonly<Record<string, number>> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };

/** `250`, `1.5k`, `100M`, `2B`; `undefined` for anything else or for zero. */
export const parseCount = (text: string | undefined): number | undefined => {
  const match = /^(\d*\.?\d+)([kmbt])?$/i.exec(text?.trim() ?? '');
  if (!match?.[1]) return undefined;
  const value = Number(match[1]) * (COUNT_SUFFIXES[(match[2] ?? '').toLowerCase()] ?? 1);
  return value > 0 ? value : undefined;
};

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'] as const;

/** `200`, `200B`, `2KB`, `1.5GB`; a bare number is bytes. */
export const parseBytes = (text: string | undefined): number | undefined => {
  const match = /^(\d*\.?\d+)([kmgtpe]?b)?$/i.exec(text?.trim() ?? '');
  if (!match?.[1]) return undefined;
  const unit = (match[2] ?? 'B').toUpperCase();
  const power = BYTE_UNITS.indexOf(unit as (typeof BYTE_UNITS)[number]);
  const value = Number(match[1]) * 1000 ** Math.max(power, 0);
  return value > 0 ? value : undefined;
};

/** Three significant digits, no trailing zeros: 11574.07 -> "11.6". */
const short = (value: number): string => String(Number(value.toPrecision(3)));

/** 11574 -> "11.6K", 1e9 -> "1B". */
export const formatCount = (value: number): string => {
  const steps: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  const [size, suffix] = steps.find(([size]) => value >= size) ?? [1, ''];
  return `${short(value / size)}${suffix}`;
};

/** 7.3e12 -> "7.3 TB". */
export const formatBytes = (bytes: number): string => {
  let power = 0;
  while (power < BYTE_UNITS.length - 1 && bytes >= 1000 ** (power + 1)) power += 1;
  return `${short(bytes / 1000 ** power)} ${BYTE_UNITS[power] ?? 'B'}`;
};

/** 31557.6 -> "8.77 h"; picks the largest unit that keeps the number at least 1. */
export const formatDuration = (seconds: number): string => {
  const units: [number, string][] = [
    [SECONDS_PER_DAY, 'd'],
    [3600, 'h'],
    [60, 'min'],
    [1, 's'],
    [1e-3, 'ms'],
  ];
  const [size, unit] = units.find(([size]) => seconds >= size) ?? [1e-3, 'ms'];
  return `${short(seconds / size)} ${unit}`;
};

/** 1048576 -> "1,048,576". */
const grouped = (value: number): string => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* ---- Layout ---------------------------------------------------------------- */

interface Column {
  /** Dimmed cells read as secondary information. */
  dim?: boolean;
  /** Right-aligned, for numbers. */
  right?: boolean;
  hideBelow?: Span['hideBelow'];
}

/**
 * Rows of aligned columns that never wrap. The first row is a dimmed header
 * unless `header` is false; the last column is left unpadded.
 */
const table = (
  rows: readonly (readonly string[])[],
  columns: readonly Column[] = [],
  header = true,
): Line[] => {
  const widths = (rows[0] ?? []).map((_, at) =>
    Math.max(...rows.map((row) => (row[at] ?? '').length)),
  );
  return rows.map((row, index) => ({
    spans: row.map((cell, at): Span => {
      const { dim: tone = false, right = false, hideBelow } = columns[at] ?? {};
      const width = widths[at] ?? 0;
      const fitted = right ? cell.padStart(width) : cell.padEnd(width);
      const text = at === row.length - 1 && !right ? cell : `${fitted}   `;
      const span: Span = (header && index === 0) || tone ? dim(text) : { text };
      return hideBelow ? { ...span, hideBelow } : span;
    }),
    nowrap: true,
  }));
};

const usage = (synopsis: string, ...examples: string[]): Line[] => [
  line(`usage: ${synopsis}`),
  ...examples.map((example) => line(dim(`  ${example}`))),
];

/* ---- qps: traffic from daily users ---------------------------------------- */

export interface Traffic {
  perDay: number;
  average: number;
  peak: number;
}

export const traffic = (users: number, requestsPerUser: number, peakFactor: number): Traffic => {
  const perDay = users * requestsPerUser;
  const average = perDay / SECONDS_PER_DAY;
  return { perDay, average, peak: average * peakFactor };
};

const qps: Command = {
  name: 'qps',
  summary: 'Requests per second from daily active users',
  usage: '<users> <per user> [peak]',
  run: ([usersArg, perUserArg, peakArg = '2']) => {
    const users = parseCount(usersArg);
    const perUser = parseCount(perUserArg);
    const peak = parseCount(peakArg);
    if (!users || !perUser || !peak) {
      return {
        lines: usage(
          'qps <daily users> <requests per user a day> [peak factor]',
          'qps 100M 10      100M users, 10 requests each, peak x2',
          'qps 50M 2 3      peak at three times the average',
        ),
      };
    }

    const { perDay, average, peak: top } = traffic(users, perUser, peak);
    return {
      lines: [
        line(dim(`${formatCount(users)} users x ${formatCount(perUser)} requests a day`)),
        line(''),
        ...table(
          [
            ['requests a day', formatCount(perDay)],
            ['average', `${formatCount(average)} QPS`],
            [`peak (x${short(peak)})`, `${formatCount(top)} QPS`],
          ],
          [{ dim: true }],
          false,
        ),
        line(''),
        line(dim('1 day = 86,400 s, call it 10^5: 1M a day is about 12 QPS')),
      ],
    };
  },
};

/* ---- storage: how much data piles up -------------------------------------- */

export const storageTotals = (
  perDay: number,
  size: number,
  years: number,
  copies: number,
): { day: number; year: number; total: number; replicated: number } => {
  const day = perDay * size;
  const year = day * DAYS_PER_YEAR;
  const total = year * years;
  return { day, year, total, replicated: total * copies };
};

const storage: Command = {
  name: 'storage',
  summary: 'Storage needed over the years, with replicas',
  usage: '<per day> <size> [years] [copies]',
  run: ([perDayArg, sizeArg, yearsArg = '5', copiesArg = '3']) => {
    const perDay = parseCount(perDayArg);
    const size = parseBytes(sizeArg);
    const years = parseCount(yearsArg);
    const copies = parseCount(copiesArg);
    if (!perDay || !size || !years || !copies) {
      return {
        lines: usage(
          'storage <new items a day> <item size> [years] [copies]',
          'storage 10M 2KB          10M items of 2KB a day, 5 years, 3 copies',
          'storage 500K 1.5MB 10 1  photos for 10 years, no replicas',
        ),
      };
    }

    const totals = storageTotals(perDay, size, years, copies);
    return {
      lines: [
        line(dim(`${formatCount(perDay)} x ${formatBytes(size)} a day`)),
        line(''),
        ...table(
          [
            ['a day', formatBytes(totals.day)],
            ['a year', formatBytes(totals.year)],
            [`${short(years)} years`, formatBytes(totals.total)],
            ...(copies > 1 ? [[`x${short(copies)} copies`, formatBytes(totals.replicated)]] : []),
          ],
          [{ dim: true }],
          false,
        ),
      ],
    };
  },
};

/* ---- bandwidth: what goes over the wire ----------------------------------- */

const bandwidth: Command = {
  name: 'bandwidth',
  summary: 'Network throughput for a request rate and size',
  usage: '<qps> <size>',
  run: ([qpsArg, sizeArg]) => {
    const rate = parseCount(qpsArg);
    const size = parseBytes(sizeArg);
    if (!rate || !size) {
      return {
        lines: usage(
          'bandwidth <qps> <bytes per request>',
          'bandwidth 12K 500KB    12K QPS of 500KB responses',
        ),
      };
    }

    const perSecond = rate * size;
    return {
      lines: [
        line(dim(`${formatCount(rate)} QPS x ${formatBytes(size)}`)),
        line(''),
        ...table(
          [
            ['throughput', `${formatBytes(perSecond)}/s`],
            ['in bits', `${short((perSecond * 8) / 1e9)} Gbps`],
            ['a day', formatBytes(perSecond * SECONDS_PER_DAY)],
          ],
          [{ dim: true }],
          false,
        ),
      ],
    };
  },
};

/* ---- servers: fleet size -------------------------------------------------- */

/** Machines needed so that none runs above `1 - headroom` of its capacity. */
export const serversNeeded = (peak: number, perServer: number, headroom: number): number =>
  Math.ceil(peak / (perServer * (1 - headroom)));

const servers: Command = {
  name: 'servers',
  summary: 'How many servers a peak load needs, with headroom',
  usage: '<qps> <per server> [headroom %]',
  run: ([peakArg, perServerArg, headroomArg = '30']) => {
    const peak = parseCount(peakArg);
    const perServer = parseCount(perServerArg);
    const headroom = Number(headroomArg);
    if (!peak || !perServer || !(headroom >= 0 && headroom < 100)) {
      return {
        lines: usage(
          'servers <peak qps> <qps one server handles> [headroom %]',
          'servers 23K 2K       keep every box under 70% load',
          'servers 23K 2K 50    survive losing half the fleet',
        ),
      };
    }

    const count = serversNeeded(peak, perServer, headroom / 100);
    return {
      lines: [
        line(bright(`${count} servers`)),
        line(
          dim(
            `${formatCount(peak)} QPS at ${formatCount(perServer)} each, ${short(100 - headroom)}% busy at most`,
          ),
        ),
      ],
    };
  },
};

/* ---- nines: availability as downtime -------------------------------------- */

/** Seconds of downtime an availability allows over a period of `seconds`. */
export const downtime = (percent: number, seconds: number): number => seconds * (1 - percent / 100);

const YEAR = DAYS_PER_YEAR * SECONDS_PER_DAY;
const COMMON_NINES = [99, 99.9, 99.95, 99.99, 99.999] as const;

const nines: Command = {
  name: 'nines',
  summary: 'Downtime allowed by 99.9%, 99.99% and so on',
  usage: '[percent]',
  run: ([percentArg]) => {
    const asked = percentArg === undefined ? undefined : Number(percentArg.replace(/%$/, ''));
    if (asked !== undefined && !(asked > 0 && asked < 100)) {
      return { lines: usage('nines [percent]', 'nines', 'nines 99.95') };
    }

    const levels = asked === undefined ? COMMON_NINES : [asked];
    return {
      lines: table(
        [
          ['UPTIME', 'A YEAR', 'A MONTH', 'A WEEK', 'A DAY'],
          ...levels.map((percent) => [
            `${percent}%`,
            formatDuration(downtime(percent, YEAR)),
            formatDuration(downtime(percent, YEAR / 12)),
            formatDuration(downtime(percent, 7 * SECONDS_PER_DAY)),
            formatDuration(downtime(percent, SECONDS_PER_DAY)),
          ]),
        ],
        [{}, {}, {}, { hideBelow: 'medium' }, {}],
      ),
    };
  },
};

/* ---- latency: numbers every programmer should know ------------------------ */

/** The classic table, in nanoseconds; the orders of magnitude are the point. */
export const LATENCIES: readonly (readonly [string, number])[] = [
  ['L1 cache reference', 0.5],
  ['Branch mispredict', 5],
  ['L2 cache reference', 7],
  ['Mutex lock/unlock', 25],
  ['Main memory reference', 100],
  ['Compress 1 KB with Snappy', 3_000],
  ['Send 1 KB over 1 Gbps', 10_000],
  ['Read 4 KB at random from SSD', 150_000],
  ['Read 1 MB from memory', 250_000],
  ['Round trip in a datacenter', 500_000],
  ['Read 1 MB from SSD', 1_000_000],
  ['Disk seek', 10_000_000],
  ['Read 1 MB from disk', 20_000_000],
  ['Round trip CA-Netherlands-CA', 150_000_000],
];

const nanoseconds = (value: number): string => {
  if (value >= 1e6) return `${short(value / 1e6)} ms`;
  if (value >= 1e3) return `${short(value / 1e3)} us`;
  return `${short(value)} ns`;
};

const latency: Command = {
  name: 'latency',
  summary: 'Latency numbers every programmer should know',
  run: () => ({
    lines: [
      ...table(
        [['TIME', 'OPERATION'], ...LATENCIES.map(([name, ns]) => [nanoseconds(ns), name])],
        [{ right: true }],
      ),
      line(''),
      line(dim('Memory is ~100x faster than SSD, SSD ~20x faster than disk.')),
    ],
  }),
};

/* ---- pow2: powers of two and handy constants ------------------------------ */

const POWERS = [
  [10, 'thousand', 'KB'],
  [20, 'million', 'MB'],
  [30, 'billion', 'GB'],
  [40, 'trillion', 'TB'],
  [50, 'quadrillion', 'PB'],
] as const;

const pow2: Command = {
  name: 'pow2',
  summary: 'Powers of two and other numbers worth knowing',
  run: () => ({
    lines: [
      ...table(
        [
          ['POWER', 'ABOUT', 'SIZE', 'EXACT'],
          ...POWERS.map(([power, name, unit]) => [
            `2^${power}`,
            `1 ${name}`,
            `1 ${unit}`,
            grouped(2 ** power),
          ]),
        ],
        [{}, {}, {}, { dim: true, hideBelow: 'medium' }],
      ),
      line(''),
      ...table(
        [
          ['seconds a day', '86,400', '~10^5'],
          ['seconds a month', '2.6M', '~2.5 x 10^6'],
          ['seconds a year', '31.5M', '~pi x 10^7'],
          ['1M requests a day', '~12 QPS', ''],
          ['1B requests a day', '~12K QPS', ''],
        ],
        [{ dim: true }, {}, { dim: true }],
        false,
      ),
    ],
  }),
};

export const estimateCommands: readonly Command[] = [
  qps,
  storage,
  bandwidth,
  servers,
  nines,
  latency,
  pow2,
];
