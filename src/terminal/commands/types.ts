import type { Line } from '../line';
import type { Phosphor, Settings } from '../settings';

/** Side effects a command asks the shell to perform. Commands stay pure. */
export type Effect =
  | { type: 'clear' }
  | { type: 'reboot' }
  | { type: 'set-phosphor'; phosphor: Phosphor }
  | { type: 'set-crt'; enabled: boolean };

export interface CommandContext {
  settings: Settings;
  history: readonly string[];
}

export interface CommandResult {
  lines: readonly Line[];
  effects?: readonly Effect[];
}

export interface Command {
  name: string;
  summary: string;
  /** Argument synopsis shown by `help`, e.g. `[amber|green]`. */
  usage?: string;
  /** Values offered by tab completion for the first argument. */
  options?: readonly string[];
  /** Hidden commands work but are not listed by `help`. */
  hidden?: boolean;
  run: (args: readonly string[], context: CommandContext) => CommandResult;
}
