import { action, line } from '../line';
import type { Line } from '../line';
import { contentCommands } from './content';
import type { Command } from './types';

/**
 * A pretend filesystem: every content command is also readable as a text file,
 * so `cat about.txt` works for visitors who reach for shell habits first.
 */
const EXTENSION = '.txt';

const files = new Map(contentCommands.map((command) => [`${command.name}${EXTENSION}`, command]));

const fileNames = [...files.keys()];

const ls: Command = {
  name: 'ls',
  summary: 'List files',
  hidden: true,
  run: () => ({
    lines: [
      {
        spans: fileNames.flatMap((name, index) => [
          ...(index > 0 ? [{ text: '  ' }] : []),
          action(`cat ${name}`, name),
        ]),
      } satisfies Line,
    ],
  }),
};

const cat: Command = {
  name: 'cat',
  summary: 'Print a file',
  usage: '<file>',
  options: fileNames,
  hidden: true,
  run: ([name], context) => {
    if (name === undefined) return { lines: [line('cat: missing file operand')] };

    const file = files.get(name) ?? files.get(`${name}${EXTENSION}`);
    return file ? file.run([], context) : { lines: [line(`cat: ${name}: No such file`)] };
  },
};

export const fileCommands: readonly Command[] = [ls, cat];
