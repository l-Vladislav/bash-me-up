import { action, blank, bright, dim, heading, line } from '../line';
import type { Line } from '../line';
import { contentCommands } from './content';
import { fileCommands } from './files';
import { gameCommands } from './games';
import { hiddenCommands, systemCommands } from './system';
import { toolCommands } from './tools';
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

const SECTIONS = ['portfolio', 'games', 'tools', 'terminal'] as const;

interface Section {
  name: (typeof SECTIONS)[number];
  summary: string;
  entries: readonly Command[];
}

const INDENT = '  ';

const synopsis = (name: string, usage?: string): string => (usage ? `${name} ${usage}` : name);

/** Rows of `name  summary`, aligned and clickable, with wrapped text hanging under the summary. */
const menu = <T>(
  items: readonly T[],
  label: (item: T) => { command: string; name: string; usage?: string; summary: string },
): Line[] => {
  const rows = items.map(label);
  const width = Math.max(...rows.map(({ name, usage }) => synopsis(name, usage).length)) + 3;
  return rows.map(({ command, name, usage, summary }) => ({
    spans: [
      { text: INDENT },
      action(command, name),
      dim((usage ? ` ${usage}` : '').padEnd(width - name.length)),
      { text: summary },
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
  ...menu(sections, ({ name, summary }) => ({ command: `help ${name}`, name, summary })),
  blank(),
  line(dim('Pick a section, or type `help <section>`. Tab completes, Up/Down recall history.')),
];

const sectionPage = ({ name, entries }: Section): Line[] => [
  heading(name),
  blank(),
  ...menu(
    entries.filter((command) => !command.hidden),
    (command) => ({ ...command, command: command.name }),
  ),
  blank(),
  line(action('help', '< all sections')),
];

const help: Command = {
  name: 'help',
  summary: 'Sections of commands; pass one to open it',
  usage: '[section]',
  options: SECTIONS,
  run: ([topic]) => {
    if (topic === undefined) return { lines: overview() };

    const section = sections.find(({ name }) => name === topic.toLowerCase());
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
    name: 'games',
    summary: 'Moon landing, hangman, tic-tac-toe, guess the number',
    entries: gameCommands,
  },
  {
    name: 'tools',
    summary: 'Calculator, calendar, Morse code, big letters and more',
    entries: toolCommands,
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
