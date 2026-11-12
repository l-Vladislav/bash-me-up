import { action, dim, line } from '../../line';
import type { Line } from '../../line';

/** Integer in [min, max], both inclusive. */
export const randomInt = (random: () => number, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

export const pick = <T>(random: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error('pick: empty list');
  return item;
};

/** Reminder printed under every game's intro. */
export const quitHint = (): Line => line(dim('Type `quit` or press Ctrl+C to leave.'));

/** Offer to play again, clickable. */
export const playAgain = (name: string): Line => line(dim('Play again? '), action(name));
