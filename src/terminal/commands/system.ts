import { profile, terminal } from '../../content/resume';
import { blank, bright, dim, line } from '../line';
import { PHOSPHORS, isPhosphor } from '../settings';
import { signOutResult, sudo } from './admin';
import type { Command } from './types';

const clear: Command = {
  name: 'clear',
  summary: 'Clear the screen (Ctrl+L)',
  run: () => ({ lines: [], effects: [{ type: 'clear' }] }),
};

const theme: Command = {
  name: 'theme',
  summary: 'Swap the phosphor colour',
  usage: `[${PHOSPHORS.join('|')}]`,
  options: PHOSPHORS,
  run: ([requested], { settings }) => {
    // Without an argument the command cycles to the next phosphor.
    const next =
      requested ?? PHOSPHORS[(PHOSPHORS.indexOf(settings.phosphor) + 1) % PHOSPHORS.length];

    if (!isPhosphor(next)) {
      return { lines: [line(`theme: unknown phosphor "${next}" (try ${PHOSPHORS.join(' or ')})`)] };
    }
    return {
      lines: [line('Phosphor set to ', bright(next), '.')],
      effects: [{ type: 'set-phosphor', phosphor: next }],
    };
  },
};

const SWITCH_MODES = ['on', 'off'] as const;

/** Reads an on/off argument; without one the switch flips. `null` for anything else. */
const switchTo = (mode: string | undefined, current: boolean): boolean | null => {
  if (mode === undefined) return !current;
  if (mode === 'on' || mode === 'off') return mode === 'on';
  return null;
};

const crt: Command = {
  name: 'crt',
  summary: 'Toggle the CRT simulation',
  usage: `[${SWITCH_MODES.join('|')}]`,
  options: SWITCH_MODES,
  run: ([mode], { settings }) => {
    const enabled = switchTo(mode, settings.crt);
    if (enabled === null) return { lines: [line(`crt: expected "on" or "off", got "${mode}"`)] };
    return {
      lines: [line('CRT simulation ', bright(enabled ? 'on' : 'off'), '.')],
      effects: [{ type: 'set-crt', enabled }],
    };
  },
};

const sound: Command = {
  name: 'sound',
  summary: 'Turn the speaker on or off',
  usage: `[${SWITCH_MODES.join('|')}]`,
  options: SWITCH_MODES,
  run: ([mode], { settings }) => {
    const enabled = switchTo(mode, settings.sound);
    if (enabled === null) return { lines: [line(`sound: expected "on" or "off", got "${mode}"`)] };
    return {
      lines: [line('Sound ', bright(enabled ? 'on' : 'off'), '.')],
      effects: [{ type: 'set-sound', enabled }],
    };
  },
};

const history: Command = {
  name: 'history',
  summary: 'Commands typed this session',
  run: (_args, context) => ({
    lines: context.history.map((entry, index) =>
      line(dim(String(index + 1).padStart(4)), `  ${entry}`),
    ),
  }),
};

const reboot: Command = {
  name: 'reboot',
  summary: 'Restart the terminal',
  run: () => ({ lines: [], effects: [{ type: 'reboot' }] }),
};

const whoami: Command = {
  name: 'whoami',
  summary: 'Print the current user',
  hidden: true,
  run: () => ({
    lines: [line(terminal.user), line(dim(`...visiting ${profile.name}, ${profile.title}.`))],
  }),
};

const exit: Command = {
  name: 'exit',
  summary: 'Leave the terminal',
  hidden: true,
  run: (_args, { root }) =>
    root
      ? signOutResult()
      : {
          lines: [
            line('There is no escape from a 1984 terminal.'),
            blank(),
            line(dim('(close the tab)')),
          ],
        },
};

export const systemCommands: readonly Command[] = [theme, crt, sound, history, clear, reboot];

export const hiddenCommands: readonly Command[] = [whoami, sudo, exit];
