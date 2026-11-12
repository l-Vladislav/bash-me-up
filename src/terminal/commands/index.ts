import { action, blank, dim, heading, line } from '../line';
import type { Line } from '../line';
import { contentCommands } from './content';
import { fileCommands } from './files';
import { hiddenCommands, systemCommands } from './system';
import type { Command, CommandContext, CommandResult } from './types';

export type { Command, CommandContext, CommandResult, Effect } from './types';

const ALIASES: Readonly<Record<string, string>> = { '?': 'help', cls: 'clear' };

const INDENT = '  ';

const help: Command = {
  name: 'help',
  summary: 'Show this list',
  run: () => {
    const listed = commands.filter((command) => !command.hidden);
    const width = Math.max(...listed.map(({ name, usage }) => synopsis(name, usage).length)) + 2;

    return {
      lines: [
        heading('commands'),
        blank(),
        ...listed.map(({ name, usage, summary }): Line => ({
          spans: [
            { text: INDENT },
            action(name),
            dim((usage ? ` ${usage}` : '').padEnd(width - name.length)),
            { text: summary },
          ],
          hang: INDENT.length + width,
        })),
        blank(),
        line(
          dim('Tab completes, Up/Down recall history, and every highlighted word is clickable.'),
        ),
      ],
    };
  },
};

const synopsis = (name: string, usage?: string): string => (usage ? `${name} ${usage}` : name);

export const commands: readonly Command[] = [
  help,
  ...contentCommands,
  ...systemCommands,
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
