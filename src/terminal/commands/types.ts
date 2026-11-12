import type { Line } from '../line';
import type { Phosphor, Settings } from '../settings';

/** Side effects a command asks the shell to perform. Commands stay pure. */
export type Effect =
  | { type: 'clear' }
  | { type: 'reboot' }
  | { type: 'set-phosphor'; phosphor: Phosphor }
  | { type: 'set-crt'; enabled: boolean };

/** Everything a command may know about the world, passed in so commands stay pure. */
export interface CommandContext {
  settings: Settings;
  history: readonly string[];
  /** Source of randomness in [0, 1); tests pass a seeded one. */
  random: () => number;
  /** Current time and power-on time, in milliseconds since the epoch. */
  now: number;
  bootedAt: number;
}

/**
 * An interactive program, such as a game, that owns the prompt until it ends.
 * Sessions are immutable: every input returns the next session, or none when
 * the program is over and the shell takes the prompt back.
 */
export interface Session {
  /** Shown in place of the shell prompt, e.g. `guess>`. */
  prompt: string;
  input: (text: string) => SessionStep;
}

export interface SessionStep {
  lines: readonly Line[];
  next?: Session;
}

export interface CommandResult {
  lines: readonly Line[];
  effects?: readonly Effect[];
  /** Starts an interactive program after the lines are printed. */
  session?: Session;
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
