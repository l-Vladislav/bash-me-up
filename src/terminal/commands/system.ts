import { profile, terminal } from '../../content/resume';
import { blank, bright, dim, line } from '../line';
import { PHOSPHORS, isPhosphor } from '../settings';
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

const CRT_MODES = ['on', 'off'] as const;

const crt: Command = {
  name: 'crt',
  summary: 'Toggle the CRT simulation',
  usage: `[${CRT_MODES.join('|')}]`,
  options: CRT_MODES,
  run: ([mode], { settings }) => {
    if (mode !== undefined && mode !== 'on' && mode !== 'off') {
      return { lines: [line(`crt: expected "on" or "off", got "${mode}"`)] };
    }
    const enabled = mode === undefined ? !settings.crt : mode === 'on';
    return {
      lines: [line('CRT simulation ', bright(enabled ? 'on' : 'off'), '.')],
      effects: [{ type: 'set-crt', enabled }],
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

const sudo: Command = {
  name: 'sudo',
  summary: 'Run a command as root',
  hidden: true,
  run: () => ({
    lines: [
      line(`${terminal.user} is not in the sudoers file.`),
      line(dim('This incident will be reported to nobody.')),
    ],
  }),
};

const exit: Command = {
  name: 'exit',
  summary: 'Leave the terminal',
  hidden: true,
  run: () => ({
    lines: [
      line('There is no escape from a 1984 terminal.'),
      blank(),
      line(dim('(close the tab)')),
    ],
  }),
};

export const systemCommands: readonly Command[] = [theme, crt, history, clear, reboot];

export const hiddenCommands: readonly Command[] = [whoami, sudo, exit];
