import { action, blank, bright, dim, heading, line } from '../line';
import type { Line } from '../line';
import { contentCommands } from './content';
import { fileCommands } from './files';
import { gameCommands } from './games';
import { hiddenCommands, systemCommands } from './system';
import { toolCommands } from './tools';
import type { Command, CommandContext, CommandResult } from './types';

export type { Command, CommandContext, CommandResult, Effect, Session, SessionStep } from './types';

const ALIASES: Readonly<Record<string, string>> = {
  '?': 'help',
  cls: 'clear',
  bc: 'calc',
  ttt: 'tictactoe',
};

const INDENT = '  ';

const synopsis = (name: string, usage?: string): string => (usage ? `${name} ${usage}` : name);

const help: Command = {
  name: 'help',
  summary: 'Show this list',
  run: () => {
    const listed = sections.map(({ title, entries }) => ({
      title,
      entries: entries.filter((command) => !command.hidden),
    }));
    const width =
      Math.max(
        ...listed.flatMap(({ entries }) =>
          entries.map(({ name, usage }) => synopsis(name, usage).length),
        ),
      ) + 2;

    const row = ({ name, usage, summary }: Command): Line => ({
      spans: [
        { text: INDENT },
        action(name),
        dim((usage ? ` ${usage}` : '').padEnd(width - name.length)),
        { text: summary },
      ],
      hang: INDENT.length + width,
    });

    return {
      lines: [
        heading('commands'),
        ...listed.flatMap(({ title, entries }) => [
          blank(),
          line(bright(title)),
          ...entries.map(row),
        ]),
        blank(),
        line(
          dim('Tab completes, Up/Down recall history, and every highlighted word is clickable.'),
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

    const aliases = Object.keys(ALIASES).filter((alias) => ALIASES[alias] === command.name);
    return {
      lines: [
        line(bright('NAME')),
        line(`    ${command.name} - ${command.summary}`),
        blank(),
        line(bright('SYNOPSIS')),
        line(`    ${synopsis(command.name, command.usage)}`),
        ...(aliases.length > 0
          ? [blank(), line(bright('ALIASES')), line(`    ${aliases.join(', ')}`)]
          : []),
      ],
    };
  },
};

const sections: readonly { title: string; entries: readonly Command[] }[] = [
  { title: 'portfolio', entries: contentCommands },
  { title: 'games', entries: gameCommands },
  { title: 'tools', entries: toolCommands },
  { title: 'terminal', entries: [help, man, ...systemCommands] },
];

export const commands: readonly Command[] = [
  ...sections.flatMap(({ entries }) => entries),
  ...fileCommands,
  ...hiddenCommands,
];

const registry = new Map(commands.map((command) => [command.name, command]));

export const findCommand = (name: string): Command | undefined => {
  const key = name.toLowerCase();
  return registry.get(ALIASES[key] ?? key);
};

export const tokenize = (input: string): string[] => input.trim().split(/\s+/).filter(Boolean);

/** Runs one line of user input and returns what the shell should print and do. */
export const execute = (input: string, context: CommandContext): CommandResult => {
  const [name, ...args] = tokenize(input);
  if (name === undefined) return { lines: [] };

  const command = findCommand(name);
  if (!command) {
    return {
      lines: [line(`${name}: command not found. Type `, action('help'), ' for the list.')],
    };
  }
  return command.run(args, context);
};
