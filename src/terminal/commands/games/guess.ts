import { blank, bright, dim, line } from '../../line';
import type { Line } from '../../line';
import type { Command, Session, SessionStep } from '../types';
import { playAgain, quitHint, randomInt } from './shared';

const MIN = 1;
const MAX = 100;

const verdict = (tries: number): string => {
  if (tries <= 4) return 'Lucky, or psychic.';
  if (tries <= 7) return 'Binary search, nicely done.';
  return 'Got there in the end.';
};

const round = (secret: number, tries: number): Session => ({
  prompt: 'guess>',
  input: (text): SessionStep => {
    const guess = Number(text);
    if (!Number.isInteger(guess) || guess < MIN || guess > MAX) {
      return {
        lines: [line(dim(`A whole number from ${MIN} to ${MAX}, please.`))],
        next: round(secret, tries),
      };
    }

    const count = tries + 1;
    if (guess === secret) {
      const won: Line[] = [
        line(bright(`${secret}`), ` it is! ${count} ${count === 1 ? 'try' : 'tries'}.`),
        line(dim(verdict(count))),
        blank(),
        playAgain('guess'),
      ];
      return { lines: won };
    }
    return {
      lines: [line(guess < secret ? 'Higher.' : 'Lower.')],
      next: round(secret, count),
    };
  },
});

export const guess: Command = {
  name: 'guess',
  summary: 'Guess the number I am thinking of',
  run: (_args, { random }) => ({
    lines: [line(`I am thinking of a number between ${MIN} and ${MAX}.`), quitHint(), blank()],
    session: round(randomInt(random, MIN, MAX), 0),
  }),
};
