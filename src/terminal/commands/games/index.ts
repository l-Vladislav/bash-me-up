import type { Command } from '../types';
import { dungeon } from './dungeon';
import { fight } from './fight';
import { guess } from './guess';
import { hangman } from './hangman';
import { millionaire } from './millionaire';
import { tictactoe } from './tictactoe';
import { xlander } from './xlander';

export const gameCommands: readonly Command[] = [
  dungeon,
  fight,
  millionaire,
  xlander,
  hangman,
  tictactoe,
  guess,
];
