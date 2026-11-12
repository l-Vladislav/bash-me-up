import { blank, bright, dim, line } from '../../line';
import type { Line } from '../../line';
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

/** The gallows, drawn one more stroke per miss. */
const gallows = (misses: number): Line[] => {
  const part = (at: number, text: string): string => (misses >= at ? text : ' ');
  return [
    '  +---+',
    '  |   |',
    `  ${part(1, 'O')}   |`,
    ` ${part(3, '/')}${part(2, '|')}${part(4, '\\')}  |`,
    ` ${part(5, '/')} ${part(6, '\\')}  |`,
    '      |',
    '=========',
  ].map((row) => ({ spans: [{ text: row }], art: true }));
};

interface Round {
  word: string;
  guessed: ReadonlySet<string>;
}

/** Wrong letters, plus any wrong whole-word guesses. */
const missesOf = ({ word, guessed }: Round): string[] =>
  [...guessed].filter((entry) => entry.length > 1 || !word.includes(entry));

const masked = ({ word, guessed }: Round): string =>
  [...word].map((letter) => (guessed.has(letter) ? letter : '_')).join(' ');

const board = (round: Round): Line[] => {
  const misses = missesOf(round);
  return [
    ...gallows(misses.length),
    blank(),
    line(bright(masked(round))),
    line(dim(`misses: ${misses.length > 0 ? misses.join(' ') : '-'}`)),
    blank(),
  ];
};

const end = (round: Round, won: boolean): SessionStep => ({
  lines: [
    ...gallows(missesOf(round).length),
    blank(),
    won
      ? line('You got it: ', bright(round.word), '.')
      : line('Hanged. The word was ', bright(round.word), '.'),
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
        : { lines: [line(`Not "${attempt}".`), ...board(next)], next: play(next) };
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
    return { lines: board(next), next: play(next) };
  },
});

export const hangman: Command = {
  name: 'hangman',
  summary: 'Guess the word before the drawing is done',
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
