import { action, blank, bright, dim, heading, line } from '../line';
import type { Line } from '../line';
import { contentCommands, galleryCommands } from './content';
import { fileCommands } from './files';
import { gameCommands } from './games';
import { hiddenCommands, systemCommands } from './system';
import { toolCommands } from './tools';
import { estimateCommands } from './tools/estimate';
import type { Command, CommandContext, CommandResult } from './types';

export type { Command, CommandContext, CommandResult, Effect, Session, SessionStep } from './types';

/** Shorthands; an alias may expand to a command with arguments. */
const ALIASES: Readonly<Record<string, string>> = {
  '?': 'help',
  cls: 'clear',
  bc: 'calc',
  ttt: 'tictactoe',
  portfolio: 'help portfolio',
  games: 'help games',
  tools: 'help tools',
};

const SECTIONS = ['portfolio', 'gallery', 'games', 'tools', 'terminal'] as const;

interface Group {
  title: string;
  entries: readonly Command[];
}

interface Section {
  name: (typeof SECTIONS)[number];
  summary: string;
  entries: readonly Command[];
  /** A section that is one command: its row, and `help <name>`, run that command instead. */
  opens?: string;
  /** Splits a long section into titled groups on its help page. */
  groups?: readonly Group[];
}

const INDENT = '  ';

const synopsis = (name: string, usage?: string): string => (usage ? `${name} ${usage}` : name);

interface MenuRow {
  command: string;
  name: string;
  usage?: string;
  summary: string;
}

const menuWidth = (rows: readonly MenuRow[]): number =>
  Math.max(...rows.map(({ name, usage }) => synopsis(name, usage).length)) + 3;

/**
 * Rows of `name  summary`, aligned and clickable, with wrapped text hanging
 * under the summary. On a phone the summary moves under the name instead.
 */
const menu = <T>(
  items: readonly T[],
  label: (item: T) => MenuRow,
  /** Summary column; pass one to line several menus up with each other. */
  width = menuWidth(items.map(label)),
): Line[] => {
  const rows = items.map(label);
  return rows.map(({ command, name, usage, summary }) => ({
    spans: [
      { text: INDENT },
      action(command, name),
      dim(usage ? ` ${usage}` : ''),
      { text: ' '.repeat(width - synopsis(name, usage).length), hideBelow: 'medium' },
      { text: summary, breakBelow: 'medium' },
    ],
    hang: INDENT.length + width,
    command,
  }));
};

const manPage = (command: Command): Line[] => {
  const aliases = Object.keys(ALIASES).filter((alias) => ALIASES[alias] === command.name);
  return [
    line(bright('NAME')),
    line(`    ${command.name} - ${command.summary}`),
    blank(),
    line(bright('SYNOPSIS')),
    line(`    ${synopsis(command.name, command.usage)}`),
    ...(aliases.length > 0
      ? [blank(), line(bright('ALIASES')), line(`    ${aliases.join(', ')}`)]
      : []),
  ];
};

const overview = (): Line[] => [
  heading('help'),
  blank(),
  ...menu(sections, ({ name, summary, opens }) => ({
    command: opens ?? `help ${name}`,
    name,
    summary,
  })),
  blank(),
  line(dim('Pick a section, or type `help <section>`. Tab completes, Up/Down recall history.')),
];

const toRow = (command: Command): MenuRow => ({ ...command, command: command.name });

const visible = (entries: readonly Command[]): Command[] =>
  entries.filter((command) => !command.hidden);

const sectionPage = ({ name, entries, groups }: Section): Line[] => {
  // One summary column for the whole page, so the groups line up.
  const width = menuWidth(visible(entries).map(toRow));
  const body = groups
    ? // The group titles part the groups, so no blank rows: the page still fits one screen.
      groups.flatMap(({ title, entries: members }) => [
        line(dim(title.toUpperCase())),
        ...menu(visible(members), toRow, width),
      ])
    : menu(visible(entries), toRow, width);
  // The way back shares the title row, as on the detail pages, so a page costs no extra lines.
  const title: Line = {
    spans: [...heading(name).spans, { text: '   ' }, action('help', '< all sections')],
  };
  return [title, blank(), ...body];
};

const help: Command = {
  name: 'help',
  summary: 'Sections of commands; pass one to open it',
  usage: '[section]',
  options: SECTIONS,
  run: ([topic], context) => {
    if (topic === undefined) return { lines: overview() };

    const section = sections.find(({ name }) => name === topic.toLowerCase());
    const opens = section?.opens === undefined ? undefined : findCommand(section.opens);
    if (opens) return opens.run([], context);
    if (section) return { lines: sectionPage(section) };

    // `help calc` reads like `man calc`.
    const command = findCommand(topic);
    if (command && !command.hidden) return { lines: manPage(command) };
    return {
      lines: [
        line(
          `help: no section "${topic}". Try `,
          ...sections.flatMap(({ name }, index) => [
            ...(index > 0 ? [', '] : []),
            action(`help ${name}`, name),
          ]),
        ),
      ],
    };
  },
};

const man: Command = {
  name: 'man',
  summary: 'Manual page for a command',
  usage: '<command>',
  run: ([name]) => {
    if (name === undefined) return { lines: [line('What manual page do you want?')] };
    const command = findCommand(name);
    if (!command || command.hidden) return { lines: [line(`No manual entry for ${name}`)] };
    return { lines: manPage(command) };
  },
};

const sections: readonly Section[] = [
  {
    name: 'portfolio',
    summary: 'About me, experience, skills, projects, contacts',
    entries: contentCommands,
  },
  {
    name: 'gallery',
    summary: 'Photos: Saint Petersburg, Norway, Utah, Lisbon, Haifa',
    entries: galleryCommands,
    opens: 'gallery',
  },
  {
    name: 'games',
    summary: 'Moon landing, hangman, tic-tac-toe, guess the number',
    entries: gameCommands,
  },
  {
    name: 'tools',
    summary: 'System design estimates, calculator, calendar, Morse code and more',
    entries: [...estimateCommands, ...toolCommands],
    groups: [
      { title: 'system design', entries: estimateCommands },
      { title: 'utilities', entries: toolCommands },
    ],
  },
  {
    name: 'terminal',
    summary: 'Colour, CRT effect, history, clear, reboot',
    entries: [help, man, ...systemCommands],
  },
];

export const commands: readonly Command[] = [
  ...sections.flatMap(({ entries }) => entries),
  ...fileCommands,
  ...hiddenCommands,
];

const registry = new Map(commands.map((command) => [command.name, command]));

export const tokenize = (input: string): string[] => input.trim().split(/\s+/).filter(Boolean);

/** Replaces a leading alias with what it stands for: `games 1` becomes `help games 1`. */
const expand = (words: readonly string[]): readonly string[] => {
  const [first = '', ...rest] = words;
  const alias = ALIASES[first.toLowerCase()];
  return alias ? [...tokenize(alias), ...rest] : words;
};

export const findCommand = (name: string): Command | undefined => {
  const [key = ''] = expand([name]);
  return registry.get(key.toLowerCase());
};

/** Runs one line of user input and returns what the shell should print and do. */
export const execute = (input: string, context: CommandContext): CommandResult => {
  const typed = tokenize(input);
  const [name, ...args] = expand(typed);
  if (name === undefined) return { lines: [] };

  const command = findCommand(name);
  if (!command) {
    return {
      lines: [
        line(`${typed[0] ?? name}: command not found. Type `, action('help'), ' for the list.'),
      ],
    };
  }
  return command.run(args, context);
};
