import type { Line } from '../line';
import type { Phosphor, Settings } from '../settings';
import type { RemoteRequest } from './admin/remote';

/** Side effects a command asks the shell to perform. Commands stay pure. */
export type Effect =
  | { type: 'clear' }
  | { type: 'reboot' }
  | { type: 'set-phosphor'; phosphor: Phosphor }
  | { type: 'set-crt'; enabled: boolean }
  /** Asks the admin API; its answer is printed by `present` in `admin/`. */
  | { type: 'remote'; request: RemoteRequest }
  /** Forgets the admin sign-in (`logout`). Signing in is a `remote` login. */
  | { type: 'sign-out' }
  /** Counts this browser's visits, or stops counting them (`countme`). */
  | { type: 'set-owner'; owner: boolean };

/** Everything a command may know about the world, passed in so commands stay pure. */
export interface CommandContext {
  settings: Settings;
  history: readonly string[];
  /** Source of randomness in [0, 1); tests pass a seeded one. */
  random: () => number;
  /** Current time and power-on time, in milliseconds since the epoch. */
  now: number;
  bootedAt: number;
  /** Signed in as the admin (`sudo`): root commands run. */
  root?: boolean;
  /** This browser is marked as the owner's, so its visits are not counted. */
  owner?: boolean;
}

/**
 * An interactive program, such as a game, that owns the prompt until it ends.
 * Sessions are immutable: every input returns the next session, or none when
 * the program is over and the shell takes the prompt back.
 */
export interface Session {
  /** Shown in place of the shell prompt, e.g. `guess>`. */
  prompt: string;
  /** Input is a password: not shown as it is typed, not echoed after. */
  secret?: boolean;
  input: (text: string) => SessionStep;
}

export interface SessionStep {
  lines: readonly Line[];
  next?: Session;
  effects?: readonly Effect[];
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
  /**
   * Only for the signed-in admin: anyone else gets "command not found", and
   * neither `help` nor tab completion offers it.
   */
  root?: boolean;
  run: (args: readonly string[], context: CommandContext) => CommandResult;
}
