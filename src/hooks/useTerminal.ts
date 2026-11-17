import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { isOwner, setOwner } from '../admin/api';
import { forgetRoot, isRoot, perform } from '../admin/remote';
import { track } from '../visits';
import { bootSequence } from '../content/boot';
import { terminal } from '../content/resume';
import { execute, findCommand, tokenize } from '../terminal/commands';
import type { CommandContext, CommandResult, Effect, Session } from '../terminal/commands';
import { present } from '../terminal/commands/admin';
import type { RemoteRequest } from '../terminal/commands/admin/remote';
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
  /** The prompt takes a password: nothing typed is shown. */
  secret: boolean;
  /** Signed in as the admin: root commands run and complete. */
  root: boolean;
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
const ROOT_PROMPT = `root@${terminal.host}:~#`;

const DEEP_LINK_PARAM = 'run';

/** Typed in a program, these hand the prompt back to the shell. */
const QUIT_WORDS = new Set(['quit', 'exit']);

const echo = (input: string, prompt = PROMPT): Line => ({
  ...line(dim(`${prompt} `), input),
  delay: 0,
  echo: true,
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
  // Root lasts until the page reloads or the terminal reboots: `sudo` asks every time.
  const [root, setRoot] = useState(isRoot);
  const [owner, setOwnerMark] = useState(isOwner);
  // A root command waiting for the API; the prompt stays hidden meanwhile.
  const [pending, setPending] = useState(false);
  const ticket = useRef(0);
  const shellPrompt = root ? ROOT_PROMPT : PROMPT;

  const contextFor = (nextHistory: readonly string[]): CommandContext => ({
    settings,
    history: nextHistory,
    random: Math.random,
    now: Date.now(),
    bootedAt,
    root,
    owner,
  });

  /** Sends a root command's request, then prints what came back. */
  const ask = (request: RemoteRequest): void => {
    const mine = ++ticket.current;
    setPending(true);
    void perform(request).then((reply) => {
      if (mine !== ticket.current) return;
      setPending(false);
      setRoot(isRoot());
      setOwnerMark(isOwner());
      const result = present(request, reply, Date.now());
      setSession(result.session ?? null);
      printerRef.current?.print([...result.lines, ...(result.session ? [] : spacer(result.lines))]);
    });
  };

  /** Carries out what a command or a program asked for besides printing. */
  const apply = (effect: Effect): void => {
    switch (effect.type) {
      case 'set-phosphor':
        updateSettings({ phosphor: effect.phosphor });
        break;
      case 'set-crt':
        updateSettings({ crt: effect.enabled });
        break;
      case 'remote':
        ask(effect.request);
        break;
      case 'sign-out':
        forgetRoot();
        setRoot(false);
        break;
      case 'set-owner':
        setOwner(effect.owner);
        setOwnerMark(effect.owner);
        break;
      case 'clear':
      case 'reboot':
        // These change the screen itself: `runCommand` handles them.
        break;
    }
  };

  /** A power cycle ends root, as it would on the real machine. */
  const dropRoot = (): void => {
    ticket.current += 1;
    setPending(false);
    forgetRoot();
    setRoot(false);
  };

  const asks = (effects: readonly Effect[] = []): boolean =>
    effects.some((effect) => effect.type === 'remote');

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
    // Only the name of a known command is counted, never what was typed after it.
    const known = findCommand(tokenize(command)[0] ?? '');
    // Nor the admin's own root commands.
    if (known && !known.root) track('command', known.name);
    // An answer from the API brings its own spacer when it comes.
    let output: readonly Line[] = [
      echo(command, shellPrompt),
      ...result.lines,
      ...(asks(result.effects) ? [] : spacer(result.lines)),
    ];

    for (const effect of result.effects ?? []) {
      switch (effect.type) {
        case 'clear':
          dispatch({ type: 'wipe', trailing: stamp([echo(command, shellPrompt)]) });
          output = [];
          break;
        case 'reboot':
          dispatch({ type: 'wipe', trailing: stamp([echo(command, shellPrompt)]) });
          output = bootSequence(settings);
          setBootedAt(Date.now());
          dropRoot();
          break;
        default:
          apply(effect);
      }
    }

    setHistory(nextHistory);
    setSession(result.session ?? null);
    printer.print(output);
  };

  /** Feeds one line to the running program. */
  const feed = (printer: LinePrinter, program: Session, input: string): void => {
    const text = input.trim();
    if (!program.secret && QUIT_WORDS.has(text.toLowerCase())) {
      setSession(null);
      printer.print([echo(text, program.prompt), blank()]);
      return;
    }

    // A password is neither shown nor kept: the echo leaves it out.
    const step = program.input(program.secret ? input : text);
    setSession(step.next ?? null);
    const ending = step.next || asks(step.effects) ? [] : [blank()];
    printer.print([echo(program.secret ? '' : text, program.prompt), ...step.lines, ...ending]);
    step.effects?.forEach(apply);
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
    const shown = session?.secret ? '' : typed;
    takePrinter()?.print([
      echo(`${shown}^C`, session?.prompt ?? shellPrompt),
      ...(session ? [blank()] : []),
    ]);
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
    dropRoot();
    printer.print(bootSequence(settings));
  };

  return {
    screen,
    busy: busy || pending,
    history,
    prompt: session?.prompt ?? shellPrompt,
    interactive: session !== null,
    secret: session?.secret ?? false,
    root,
    run,
    click,
    interrupt,
    clear,
    skip,
    reboot,
  };
};
