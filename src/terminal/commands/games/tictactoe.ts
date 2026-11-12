import { action, blank, bright, dim, line } from '../../line';
import type { Line, Span } from '../../line';
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

export const winner = (board: Board): Mark | null => {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return mark;
  }
  return null;
};

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

/** The grid; free cells are numbered buttons, so a click is a move. */
const grid = (board: Board): Line[] => {
  const cell = (index: number): Span => {
    const mark = board[index];
    // Free cells are dim so the marks stand out; they are still buttons.
    return mark ? bright(mark) : { ...action(String(index + 1)), tone: 'dim' };
  };
  const row = (start: number): Line =>
    line(' ', cell(start), dim(' | '), cell(start + 1), dim(' | '), cell(start + 2));
  const rule = line(dim('---+---+---'));
  return [row(0), rule, row(3), rule, row(6)];
};

const finish = (board: Board): SessionStep | undefined => {
  const won = winner(board);
  const message = won === 'X' ? 'You win!' : won === 'O' ? 'I win.' : 'A draw.';
  if (!won && freeCells(board).length > 0) return undefined;
  return { lines: [...grid(board), blank(), line(message), blank(), playAgain('tictactoe')] };
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
