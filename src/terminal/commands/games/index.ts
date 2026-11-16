import type { Command } from '../types';
import { dungeon } from './dungeon';
import { fight } from './fight';
import { guess } from './guess';
import { hangman } from './hangman';
import { lander } from './lander';
import { millionaire } from './millionaire';
import { tictactoe } from './tictactoe';

export const gameCommands: readonly Command[] = [
  dungeon,
  fight,
  millionaire,
  lander,
  hangman,
  tictactoe,
  guess,
];
