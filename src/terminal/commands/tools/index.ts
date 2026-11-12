import { terminal } from '../../../content/resume';
import { bright, dim, line } from '../../line';
import type { Line, Span } from '../../line';
import { pick } from '../games/shared';
import type { Command } from '../types';
import { renderBanner } from './banner';
import { CalcError, evaluate, formatNumber } from './calc';
import { fromMorse, isMorse, toMorse } from './morse';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const two = (value: number): string => String(value).padStart(2, '0');

const clock = (date: Date): string =>
  `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;

/** `Thu Nov 12 19:44:47 2026`, the way `date` has always printed it. */
const date: Command = {
  name: 'date',
  summary: 'Print the date and time',
  run: (_args, { now }) => {
    const at = new Date(now);
    const day = DAYS[at.getDay()] ?? '';
    const month = (MONTHS[at.getMonth()] ?? '').slice(0, 3);
    return {
      lines: [line(`${day} ${month} ${two(at.getDate())} ${clock(at)} ${at.getFullYear()}`)],
    };
  },
};

/** A month as `cal` lays it out: weeks start on Sunday, today is inverted. */
export const calendar = (year: number, month: number, today?: number): Line[] => {
  const title = `${MONTHS[month] ?? ''} ${year}`;
  const offset = new Date(year, month, 1).getDay();
  const length = new Date(year, month + 1, 0).getDate();

  const weeks: Span[][] = [];
  for (let day = 1 - offset; day <= length; day += 7) {
    const week: Span[] = [];
    for (let column = 0; column < 7; column += 1) {
      const current = day + column;
      const gap = column === 0 ? '' : ' ';
      const text = current >= 1 && current <= length ? String(current).padStart(2) : '  ';
      if (gap) week.push({ text: gap });
      week.push(current === today ? { text, tone: 'inverse' } : { text });
    }
    weeks.push(week);
  }

  const width = 20;
  return [
    line(bright(title.padStart(Math.floor((width + title.length) / 2)))),
    line(dim(DAYS.map((name) => name.slice(0, 2)).join(' '))),
    ...weeks.map((spans): Line => ({ spans, nowrap: true })),
  ];
};

const cal: Command = {
  name: 'cal',
  summary: 'Show a calendar',
  usage: '[month] [year]',
  run: ([monthArg, yearArg], { now }) => {
    const at = new Date(now);
    const month = monthArg === undefined ? at.getMonth() + 1 : Number(monthArg);
    const year = yearArg === undefined ? at.getFullYear() : Number(yearArg);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return { lines: [line(`cal: ${monthArg ?? ''} is not a month (1-12)`)] };
    }
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      return { lines: [line(`cal: ${yearArg ?? ''} is not a year (1-9999)`)] };
    }

    const isCurrent = year === at.getFullYear() && month === at.getMonth() + 1;
    return { lines: calendar(year, month - 1, isCurrent ? at.getDate() : undefined) };
  },
};

const uptime: Command = {
  name: 'uptime',
  summary: 'How long the terminal has been on',
  run: (_args, { now, bootedAt }) => {
    const minutes = Math.max(0, Math.floor((now - bootedAt) / 60_000));
    const up = `${Math.floor(minutes / 60)}:${two(minutes % 60)}`;
    // One visitor keeps a 1984 terminal mostly idle.
    return {
      lines: [line(`${clock(new Date(now))} up ${up}, 1 user, load average: 0.08, 0.03, 0.01`)],
    };
  },
};

const uname: Command = {
  name: 'uname',
  summary: 'Print system information',
  usage: '[-a]',
  options: ['-a'],
  run: ([flag]) => ({
    lines: [
      line(
        flag === '-a'
          ? `${terminal.model} ${terminal.host} ${terminal.rom.replace(/^ROM\s*/, '')} vt-serial 9600-8N1`
          : terminal.model,
      ),
    ],
  }),
};

const echo: Command = {
  name: 'echo',
  summary: 'Print the arguments',
  usage: '<text>',
  run: (args) => ({ lines: [line(args.join(' '))] }),
};

const calc: Command = {
  name: 'calc',
  summary: 'Evaluate arithmetic, e.g. calc 2^10 / 4',
  usage: '<expression>',
  run: (args) => {
    if (args.length === 0) {
      return {
        lines: [
          line('usage: calc <expression>'),
          line(dim('  + - * / % ^ ( )  pi e  sqrt abs sin cos tan ln log round floor ceil')),
        ],
      };
    }
    try {
      return { lines: [line(bright(formatNumber(evaluate(args.join(' ')))))] };
    } catch (error) {
      if (error instanceof CalcError) return { lines: [line(`calc: ${error.message}`)] };
      throw error;
    }
  },
};

const BANNER_LIMIT = 16;

const banner: Command = {
  name: 'banner',
  summary: 'Print text in big letters',
  usage: '<text>',
  run: (args) => {
    const text = args.join(' ');
    if (!text) return { lines: [line('usage: banner <text>')] };
    if (text.length > BANNER_LIMIT) {
      return { lines: [line(`banner: up to ${BANNER_LIMIT} characters fit on the screen`)] };
    }
    return {
      lines: renderBanner(text).map((row): Line => ({ spans: [{ text: row }], art: true })),
    };
  },
};

const morse: Command = {
  name: 'morse',
  summary: 'Encode text as Morse code, or decode it',
  usage: '<text|code>',
  run: (args) => {
    const text = args.join(' ');
    if (!text) return { lines: [line('usage: morse <text>  or  morse ... --- ...')] };
    const result = isMorse(text) ? fromMorse(text) : toMorse(text);
    return { lines: [line(result || dim('(nothing Morse can say)'))] };
  },
};

export const FORTUNES = [
  'The bug is never where you are looking. That is why you are still looking.',
  'Weeks of coding can save you hours of planning.',
  'There is no cloud. It is just someone else’s server room, with the lights on.',
  'A good commit message is a letter to the person you will be in six months.',
  'Premature optimisation has a twin: premature abstraction.',
  'It works on my terminal.',
  'Every legacy system was somebody’s greenfield project.',
  'Read the error message. Then read it again.',
  'Deleted code has no bugs.',
  'The fastest request is the one you never make.',
  'Naming things is hard. Renaming them is harder.',
  'Tests are the only documentation that complains when it goes out of date.',
  'Today’s hack is tomorrow’s core infrastructure.',
  'Simple is not the same as easy, and easy is rarely simple.',
  'If it hurts, do it more often: deploys, merges, conversations.',
  'Your future self is your most important user.',
] as const;

const fortune: Command = {
  name: 'fortune',
  summary: 'An aphorism from the machine room',
  run: (_args, { random }) => ({ lines: [line(pick(random, FORTUNES))] }),
};

export const toolCommands: readonly Command[] = [
  calc,
  banner,
  morse,
  fortune,
  cal,
  date,
  uptime,
  uname,
  echo,
];
