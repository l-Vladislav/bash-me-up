import type { Command } from '../types';
import { guess } from './guess';
import { hangman } from './hangman';
import { lander } from './lander';
import { tictactoe } from './tictactoe';

export const gameCommands: readonly Command[] = [lander, hangman, tictactoe, guess];
