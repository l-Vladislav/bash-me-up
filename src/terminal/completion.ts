import { commands, findCommand } from './commands';

const commonPrefix = (words: readonly string[]): string => {
  const [first = '', ...rest] = words;
  let length = first.length;
  for (const word of rest) {
    while (!word.startsWith(first.slice(0, length))) length -= 1;
  }
  return first.slice(0, length);
};

/**
 * Tab completion: extends `input` as far as the matching candidates agree.
 * Completes the command name first, then that command's first argument.
 * Root commands are offered only to the signed-in admin.
 */
export const complete = (input: string, root = false): string => {
  const trimmed = input.trimStart();
  const [head = '', ...rest] = trimmed.split(/\s+/);

  if (rest.length === 0) {
    const names = commands
      .filter((command) => root || !command.root)
      .map((command) => command.name)
      .filter((name) => name.startsWith(head));
    if (names.length === 0) return input;
    return names.length === 1 ? `${names[0]} ` : commonPrefix(names);
  }

  const command = findCommand(head);
  const options = command && (root || !command.root) ? command.options : undefined;
  if (!options || rest.length > 1) return input;

  const partial = rest[0] ?? '';
  const matches = options.filter((option) => option.startsWith(partial));
  if (matches.length === 0) return input;
  return `${head} ${matches.length === 1 ? matches[0] : commonPrefix(matches)}`;
};
