import { action, animated, blank, bright, cued, dim, line } from '../../line';
import type { Cue, Line, Span } from '../../line';
import type { Command, Session, SessionStep } from '../types';
import { pick, playAgain, quitHint } from './shared';

type Mark = 'X' | 'O';
export type Board = readonly (Mark | null)[];

const EMPTY: Board = Array<Mark | null>(9).fill(null);

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

/** How often the machine plays a random move instead of the best one. */
const BLUNDER_RATE = 0.2;

/** The three cells in a row that won the game, if any. */
const winningLine = (board: Board): readonly number[] | undefined =>
  LINES.find(([a, b, c]) => {
    const mark = board[a];
    return mark !== null && mark === board[b] && mark === board[c];
  });

export const winner = (board: Board): Mark | null => {
  const [cell] = winningLine(board) ?? [];
  return cell === undefined ? null : (board[cell] ?? null);
};

/** How many times the winning line blinks, and how long each half of a blink lasts. */
const BLINKS = 3;
const BLINK_MS = 220;

const freeCells = (board: Board): number[] =>
  board.flatMap((mark, index) => (mark === null ? [index] : []));

const place = (board: Board, cell: number, mark: Mark): Board =>
  board.map((current, index) => (index === cell ? mark : current));

/** Minimax score from O's point of view: +1 O wins, -1 X wins, 0 draw. */
const score = (board: Board, turn: Mark): number => {
  const won = winner(board);
  if (won) return won === 'O' ? 1 : -1;
  const free = freeCells(board);
  if (free.length === 0) return 0;

  const scores = free.map((cell) => score(place(board, cell, turn), turn === 'O' ? 'X' : 'O'));
  return turn === 'O' ? Math.max(...scores) : Math.min(...scores);
};

/** The machine's move: the best one, except for an occasional blunder. */
export const machineMove = (board: Board, random: () => number): number => {
  const free = freeCells(board);
  if (random() < BLUNDER_RATE) return pick(random, free);

  const scored = free.map((cell) => ({ cell, value: score(place(board, cell, 'O'), 'X') }));
  const best = Math.max(...scored.map(({ value }) => value));
  return pick(
    random,
    scored.filter(({ value }) => value === best).map(({ cell }) => cell),
  );
};

/** The grid; free cells are numbered buttons, so a click is a move. `faded` marks are dimmed. */
const grid = (board: Board, faded: readonly number[] = []): Line[] => {
  const cell = (index: number): Span => {
    const mark = board[index];
    // Free cells are dim so the marks stand out; they are still buttons.
    if (!mark) return { ...action(String(index + 1)), tone: 'dim' };
    return faded.includes(index) ? dim(mark) : bright(mark);
  };
  const row = (start: number): Line =>
    line(' ', cell(start), dim(' | '), cell(start + 1), dim(' | '), cell(start + 2));
  const rule = line(dim('---+---+---'));
  return [row(0), rule, row(3), rule, row(6)];
};

const finish = (board: Board): SessionStep | undefined => {
  const won = winner(board);
  const message = won === 'X' ? 'You win!' : won === 'O' ? 'I win.' : 'A draw.';
  const sound: Cue = won === 'X' ? 'win' : won === 'O' ? 'lose' : 'draw';
  if (!won && freeCells(board).length > 0) return undefined;

  // The three in a row blink before the board comes to rest.
  const three = winningLine(board) ?? [];
  const blink = Array.from({ length: BLINKS * 2 }, (_, half) => ({
    lines: grid(board, half % 2 === 0 ? three : []),
    ms: BLINK_MS,
  }));
  return {
    lines: [
      ...animated(grid(board), won ? blink : []),
      blank(),
      cued(sound, line(message)),
      blank(),
      playAgain('tictactoe'),
    ],
  };
};

const play = (board: Board, random: () => number): Session => ({
  prompt: 'move 1-9>',
  input: (text): SessionStep => {
    const cell = Number(text) - 1;
    if (!Number.isInteger(cell) || board[cell] === undefined) {
      return { lines: [line(dim('Pick a cell from 1 to 9.'))], next: play(board, random) };
    }
    if (board[cell] !== null) {
      return { lines: [line(dim('That cell is taken.'))], next: play(board, random) };
    }

    const yours = place(board, cell, 'X');
    const afterYou = finish(yours);
    if (afterYou) return afterYou;

    const mine = place(yours, machineMove(yours, random), 'O');
    return finish(mine) ?? { lines: [...grid(mine), blank()], next: play(mine, random) };
  },
});

export const tictactoe: Command = {
  name: 'tictactoe',
  summary: 'Noughts and crosses against the machine',
  music: 'tictactoe',
  run: (_args, { random }) => ({
    lines: [
      line('You are ', bright('X'), ' and go first. Type a cell number or click it.'),
      quitHint(),
      blank(),
      ...grid(EMPTY),
      blank(),
    ],
    session: play(EMPTY, random),
  }),
};
