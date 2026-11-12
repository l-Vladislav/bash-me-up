import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { bootSequence } from '../content/boot';
import { terminal } from '../content/resume';
import { execute } from '../terminal/commands';
import { blank, dim, line } from '../terminal/line';
import type { Line } from '../terminal/line';
import { LinePrinter } from '../terminal/printer';
import { EMPTY_SCREEN, screenReducer } from '../terminal/screen';
import type { Entry, Screen } from '../terminal/screen';
import type { Settings } from '../terminal/settings';
import type { UpdateSettings } from './useSettings';

export interface Shell {
  /** The live picture plus the fading ghost of the last one wiped. */
  screen: Screen;
  /** True while output is still being printed; the prompt is hidden meanwhile. */
  busy: boolean;
  history: readonly string[];
  run: (input: string) => void;
  /** Finishes the current printout immediately. */
  skip: () => void;
  /** Wipes the screen and runs the power-on sequence again. */
  reboot: () => void;
}

export const PROMPT = `${terminal.user}@${terminal.host}:~$`;

const DEEP_LINK_PARAM = 'run';

const echo = (input: string): Line => ({ ...line(dim(`${PROMPT} `), input), delay: 0 });

/** A blank row that sets a command's output apart from the next prompt. */
const spacer = (lines: readonly Line[]): Line[] => (lines.length > 0 ? [blank()] : []);

let nextEntryId = 0;

/** Gives each printed line a stable identity for rendering. */
const stamp = (lines: readonly Line[]): Entry[] =>
  lines.map((entry) => ({ id: nextEntryId++, line: entry }));

/** Connects the pure command layer to React state and the line printer. */
export const useTerminal = (settings: Settings, updateSettings: UpdateSettings): Shell => {
  const [screen, dispatch] = useReducer(screenReducer, EMPTY_SCREEN);
  const [busy, setBusy] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const printerRef = useRef<LinePrinter | null>(null);

  const boot = useEffectEvent((printer: LinePrinter) => {
    printer.print(bootSequence(settings));

    // Deep link: `?run=projects` types a command for the visitor after boot.
    const initial = new URLSearchParams(window.location.search).get(DEEP_LINK_PARAM)?.trim();
    if (initial) {
      const { lines } = execute(initial, { settings, history: [] });
      printer.print([echo(initial), ...lines, ...spacer(lines)]);
    }
  });

  useEffect(() => {
    const printer = new LinePrinter(
      (lines) => dispatch({ type: 'print', entries: stamp(lines) }),
      setBusy,
    );

    printerRef.current = printer;
    boot(printer);

    return () => {
      printer.dispose();
      printerRef.current = null;
    };
  }, []);

  const run = (input: string): void => {
    const printer = printerRef.current;
    if (!printer) return;
    printer.flush();

    const command = input.trim();
    const nextHistory = command ? [...history, command] : history;
    const result = execute(command, { settings, history: nextHistory });
    let output: readonly Line[] = [echo(command), ...result.lines, ...spacer(result.lines)];

    for (const effect of result.effects ?? []) {
      switch (effect.type) {
        case 'clear':
          dispatch({ type: 'wipe', trailing: stamp([echo(command)]) });
          output = [];
          break;
        case 'reboot':
          dispatch({ type: 'wipe', trailing: stamp([echo(command)]) });
          output = bootSequence(settings);
          break;
        case 'set-phosphor':
          updateSettings({ phosphor: effect.phosphor });
          break;
        case 'set-crt':
          updateSettings({ crt: effect.enabled });
          break;
      }
    }

    setHistory(nextHistory);
    printer.print(output);
  };

  const skip = (): void => printerRef.current?.flush();

  const reboot = (): void => {
    const printer = printerRef.current;
    if (!printer) return;
    printer.flush();
    dispatch({ type: 'wipe' });
    printer.print(bootSequence(settings));
  };

  return { screen, busy, history, run, skip, reboot };
};
