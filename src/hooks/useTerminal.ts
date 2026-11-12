import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { bootSequence } from '../content/boot';
import { terminal } from '../content/resume';
import { execute, findCommand, tokenize } from '../terminal/commands';
import type { CommandContext, CommandResult, Session } from '../terminal/commands';
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
  /** The shell prompt, or the running program's own. */
  prompt: string;
  /** True while a program such as a game owns the prompt. */
  interactive: boolean;
  /** Handles a typed line: a shell command, or input for the running program. */
  run: (input: string) => void;
  /** Runs a clicked command; a shell command quits the running program first. */
  click: (command: string) => void;
  /** Ctrl+C: abandons the typed line and quits the running program. */
  interrupt: (typed: string) => void;
  /** Ctrl+L: wipes the screen without running anything. */
  clear: () => void;
  /** Finishes the current printout immediately. */
  skip: () => void;
  /** Wipes the screen and runs the power-on sequence again. */
  reboot: () => void;
}

export const PROMPT = `${terminal.user}@${terminal.host}:~$`;

const DEEP_LINK_PARAM = 'run';

/** Typed in a program, these hand the prompt back to the shell. */
const QUIT_WORDS = new Set(['quit', 'exit']);

const echo = (input: string, prompt = PROMPT): Line => ({
  ...line(dim(`${prompt} `), input),
  delay: 0,
});

/** A blank row that sets a command's output apart from the next prompt. */
const spacer = (lines: readonly Line[]): Line[] => (lines.length > 0 ? [blank()] : []);

interface DeepLink {
  input: string;
  result: CommandResult;
}

const readDeepLink = (settings: Settings): DeepLink | null => {
  const input = new URLSearchParams(window.location.search).get(DEEP_LINK_PARAM)?.trim();
  if (!input) return null;
  const now = Date.now();
  const context = { settings, history: [], random: Math.random, now, bootedAt: now };
  return { input, result: execute(input, context) };
};

let nextEntryId = 0;

/** Gives each printed line a stable identity for rendering. */
const stamp = (lines: readonly Line[]): Entry[] =>
  lines.map((entry) => ({ id: nextEntryId++, line: entry }));

/** Connects the pure command layer to React state and the line printer. */
export const useTerminal = (settings: Settings, updateSettings: UpdateSettings): Shell => {
  const [screen, dispatch] = useReducer(screenReducer, EMPTY_SCREEN);
  const [busy, setBusy] = useState(true);
  const [history, setHistory] = useState<string[]>([]);
  const [bootedAt, setBootedAt] = useState(Date.now);
  // Deep link: `?run=projects` types a command for the visitor after boot. It may start a game.
  const [deepLink] = useState(() => readDeepLink(settings));
  const [session, setSession] = useState<Session | null>(deepLink?.result.session ?? null);
  const printerRef = useRef<LinePrinter | null>(null);

  const contextFor = (nextHistory: readonly string[]): CommandContext => ({
    settings,
    history: nextHistory,
    random: Math.random,
    now: Date.now(),
    bootedAt,
  });

  const boot = useEffectEvent((printer: LinePrinter) => {
    printer.print(bootSequence(settings));
    if (deepLink) {
      const { input, result } = deepLink;
      printer.print([echo(input), ...result.lines, ...spacer(result.lines)]);
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

  /** Runs `input` as a shell command, ignoring any running program. */
  const runCommand = (printer: LinePrinter, input: string): void => {
    const command = input.trim();
    const nextHistory = command ? [...history, command] : history;
    const result = execute(command, contextFor(nextHistory));
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
          setBootedAt(Date.now());
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
    setSession(result.session ?? null);
    printer.print(output);
  };

  /** Feeds one line to the running program. */
  const feed = (printer: LinePrinter, program: Session, input: string): void => {
    const text = input.trim();
    if (QUIT_WORDS.has(text.toLowerCase())) {
      setSession(null);
      printer.print([echo(text, program.prompt), blank()]);
      return;
    }

    const step = program.input(text);
    setSession(step.next ?? null);
    printer.print([echo(text, program.prompt), ...step.lines, ...(step.next ? [] : [blank()])]);
  };

  /** The printer, with any printout in progress finished first. */
  const takePrinter = (): LinePrinter | null => {
    const printer = printerRef.current;
    printer?.flush();
    return printer;
  };

  const run = (input: string): void => {
    const printer = takePrinter();
    if (!printer) return;
    if (session) feed(printer, session, input);
    else runCommand(printer, input);
  };

  const click = (command: string): void => {
    const printer = takePrinter();
    if (!printer) return;
    // Game buttons (board cells) go to the game; anything the shell knows leaves it.
    const [name = ''] = tokenize(command);
    if (session && !findCommand(name)) feed(printer, session, command);
    else runCommand(printer, command);
  };

  const interrupt = (typed: string): void => {
    takePrinter()?.print([echo(`${typed}^C`, session?.prompt), ...(session ? [blank()] : [])]);
    setSession(null);
  };

  const clear = (): void => {
    takePrinter();
    dispatch({ type: 'wipe' });
  };

  const skip = (): void => printerRef.current?.flush();

  const reboot = (): void => {
    const printer = takePrinter();
    if (!printer) return;
    dispatch({ type: 'wipe' });
    setSession(null);
    setBootedAt(Date.now());
    printer.print(bootSequence(settings));
  };

  return {
    screen,
    busy,
    history,
    prompt: session?.prompt ?? PROMPT,
    interactive: session !== null,
    run,
    click,
    interrupt,
    clear,
    skip,
    reboot,
  };
};
