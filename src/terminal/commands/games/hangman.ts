import { animated, blank, bright, cued, dim, line } from '../../line';
import type { Cue, Line } from '../../line';
import type { Command, Session, SessionStep } from '../types';
import { pick, playAgain, quitHint } from './shared';

export const WORDS = [
  'ASSEMBLER',
  'BACKSPACE',
  'BANDWIDTH',
  'BOOTLOADER',
  'CARTRIDGE',
  'COMPILER',
  'CURSOR',
  'DAEMON',
  'DEBUGGER',
  'DISKETTE',
  'FIRMWARE',
  'FLOPPY',
  'KERNEL',
  'KEYBOARD',
  'MAINFRAME',
  'MODEM',
  'MONITOR',
  'OSCILLOSCOPE',
  'PHOSPHOR',
  'PRINTER',
  'PROMPT',
  'PUNCHCARD',
  'REGISTER',
  'SCANLINE',
  'SEMICOLON',
  'SPREADSHEET',
  'TELETYPE',
  'TERMINAL',
  'TRANSISTOR',
  'VARIABLE',
] as const;

export const MAX_MISSES = 6;

/** Columns the body may swing either way, and how long it hangs at each point. */
const SWING = [0, 1, 0, -1] as const;
const SWING_MS = 380;

/** The gallows, drawn one more stroke per miss; `sway` moves the body off the vertical. */
const gallows = (misses: number, sway = 0): Line[] => {
  const part = (at: number, text: string): string => (misses >= at ? text : ' ');
  // Five columns of body, pushed sideways without touching the post.
  const body = (text: string): string =>
    `${sway > 0 ? ` ${text.slice(0, -1)}` : sway < 0 ? `${text.slice(1)} ` : text} |`;
  return [
    '  +---+',
    '  |   |',
    body(`  ${part(1, 'O')}  `),
    body(` ${part(3, '/')}${part(2, '|')}${part(4, '\\')} `),
    body(` ${part(5, '/')} ${part(6, '\\')} `),
    '      |',
    '=========',
  ].map((row) => ({ spans: [{ text: row }], art: true }));
};

/** The finished drawing, swinging in the wind. */
const hanged = (): Line[] =>
  animated(
    gallows(MAX_MISSES),
    SWING.map((sway) => ({ lines: gallows(MAX_MISSES, sway), ms: SWING_MS })),
  ).map((row) => ({ ...row, loop: true }));

interface Round {
  word: string;
  guessed: ReadonlySet<string>;
}

/** Wrong letters, plus any wrong whole-word guesses. */
const missesOf = ({ word, guessed }: Round): string[] =>
  [...guessed].filter((entry) => entry.length > 1 || !word.includes(entry));

const masked = ({ word, guessed }: Round): string =>
  [...word].map((letter) => (guessed.has(letter) ? letter : '_')).join(' ');

/** The drawing and the word; `cue` sounds as the word shows, for the letter just tried. */
const board = (round: Round, cue?: Cue): Line[] => {
  const misses = missesOf(round);
  return [
    ...gallows(misses.length),
    blank(),
    cued(cue, line(bright(masked(round)))),
    line(dim(`misses: ${misses.length > 0 ? misses.join(' ') : '-'}`)),
    blank(),
  ];
};

const end = (round: Round, won: boolean): SessionStep => ({
  lines: [
    ...(won ? gallows(missesOf(round).length) : hanged()),
    blank(),
    won
      ? cued('win', line('You got it: ', bright(round.word), '.'))
      : cued('lose', line('Hanged. The word was ', bright(round.word), '.')),
    blank(),
    playAgain('hangman'),
  ],
});

const play = (round: Round): Session => ({
  prompt: 'letter>',
  input: (text): SessionStep => {
    const attempt = text.toUpperCase();

    // A whole word is a gamble: right wins, wrong costs a miss like any letter.
    if (attempt.length > 1 && /^[A-Z]+$/.test(attempt)) {
      if (attempt === round.word) return end({ ...round, guessed: new Set(round.word) }, true);
      const next = { ...round, guessed: new Set([...round.guessed, attempt]) };
      return missesOf(next).length >= MAX_MISSES
        ? end(next, false)
        : { lines: [line(`Not "${attempt}".`), ...board(next, 'wrong')], next: play(next) };
    }

    if (!/^[A-Z]$/.test(attempt)) {
      return { lines: [line(dim('One letter, or the whole word.'))], next: play(round) };
    }
    if (round.guessed.has(attempt)) {
      return { lines: [line(dim(`Already tried ${attempt}.`))], next: play(round) };
    }

    const next = { ...round, guessed: new Set([...round.guessed, attempt]) };
    if ([...next.word].every((letter) => next.guessed.has(letter))) return end(next, true);
    if (missesOf(next).length >= MAX_MISSES) return end(next, false);
    const found = next.word.includes(attempt);
    return { lines: board(next, found ? 'right' : 'wrong'), next: play(next) };
  },
});

export const hangman: Command = {
  name: 'hangman',
  summary: 'Guess the word before the drawing is done',
  music: 'hangman',
  run: (_args, { random }) => {
    const round: Round = { word: pick(random, WORDS), guessed: new Set() };
    return {
      lines: [
        line(`A word from the machine room, ${round.word.length} letters.`),
        quitHint(),
        blank(),
        ...board(round),
      ],
      session: play(round),
    };
  },
};
