import { describe, expect, it } from 'vitest';
import { toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute } from '../index';
import type { CommandContext, Session, SessionStep } from '../types';
import { MAX_MISSES, WORDS } from './hangman';
import { START, fly } from './lander';
import type { Craft } from './lander';
import { machineMove, winner } from './tictactoe';
import type { Board } from './tictactoe';

const contextWith = (random: () => number): CommandContext => ({
  settings: DEFAULT_SETTINGS,
  history: [],
  random,
  now: 0,
  bootedAt: 0,
});

const start = (command: string, random: () => number = () => 0): Session => {
  const { session } = execute(command, contextWith(random));
  if (!session) throw new Error(`${command} did not start a session`);
  return session;
};

const text = (step: SessionStep): string => step.lines.map(toPlainText).join('\n');

/** Feeds inputs one by one until they run out or the game ends; returns the last step. */
const playThrough = (session: Session, inputs: readonly string[]): SessionStep => {
  let current: Session | undefined = session;
  let step: SessionStep = { lines: [] };
  for (const input of inputs) {
    if (!current) break;
    step = current.input(input);
    current = step.next;
  }
  return step;
};

describe('guess', () => {
  // random 0.42 picks 43
  const game = () => start('guess', () => 0.42);

  it('steers the player towards the number and ends on a hit', () => {
    expect(text(playThrough(game(), ['50']))).toBe('Lower.');
    expect(text(playThrough(game(), ['20']))).toBe('Higher.');

    const won = playThrough(game(), ['50', '40', '43']);
    expect(text(won)).toContain('43 it is! 3 tries.');
    expect(won.next).toBeUndefined();
  });

  it('rejects input that is not a number in range without counting it', () => {
    const step = playThrough(game(), ['abc']);
    expect(text(step)).toContain('A whole number from 1 to 100');
    expect(text(playThrough(game(), ['abc', '101', '43']))).toContain('1 try.');
  });
});

describe('lander', () => {
  it('free fall follows the equations of motion', () => {
    const flight = fly(START, 0);
    expect(flight.landed).toBe(false);
    if (flight.landed) return;
    expect(flight.craft.altitude).toBeCloseTo(1000 - (40 * 5 + 0.5 * 1.62 * 25));
    expect(flight.craft.velocity).toBeCloseTo(40 + 1.62 * 5);
    expect(flight.craft.time).toBe(5);
  });

  it('never burns more fuel than is left', () => {
    const flight = fly({ ...START, fuel: 4 }, 30);
    expect(flight.landed === false && flight.craft.fuel).toBe(0);
  });

  it('a careful pilot can land softly', () => {
    // Each turn, pick the burn that best tracks a safe descent profile.
    let craft: Craft = START;
    for (let turn = 0; turn < 40; turn += 1) {
      const options = Array.from({ length: 31 }, (_, burn) => ({ burn, flight: fly(craft, burn) }));
      const landing = options
        .filter(({ flight }) => flight.landed)
        .map(({ flight }) => (flight.landed ? Math.abs(flight.speed) : Infinity));
      if (landing.length > 0 && Math.min(...landing) < 5) return;

      const target = (c: Craft): number => Math.abs(c.velocity - Math.max(3, c.altitude / 12));
      const next = options
        .flatMap(({ flight }) => (flight.landed ? [] : [flight.craft]))
        .sort((a, b) => target(a) - target(b))[0];
      if (!next) break;
      craft = next;
    }
    throw new Error('no soft landing found');
  });

  it('crashes in free fall and ends the game', () => {
    const step = playThrough(start('lander'), Array<string>(20).fill('0'));
    expect(text(step)).toContain('No survivors');
    expect(step.next).toBeUndefined();
  });

  it('coasts to the ground once the fuel is gone', () => {
    const session = start('lander');
    const empty = playThrough(session, ['30', '30', '30', '30']);
    expect(text(empty)).toContain('FUEL EXHAUSTED');
    expect(empty.next?.input('').next).toBeUndefined();
  });

  it('rejects burns out of range', () => {
    expect(text(playThrough(start('lander'), ['31']))).toContain('Burn rate from 0 to 30');
  });
});

describe('hangman', () => {
  // random 0 picks the first word
  const word = WORDS[0];
  const letters = [...new Set(word)];
  const wrong = [...'QWYZXJKV'].filter((letter) => !word.includes(letter));

  it('wins once every letter is found', () => {
    const step = playThrough(start('hangman'), letters);
    expect(text(step)).toContain(`You got it: ${word}.`);
    expect(step.next).toBeUndefined();
  });

  it(`loses after ${MAX_MISSES} misses`, () => {
    const step = playThrough(start('hangman'), wrong.slice(0, MAX_MISSES));
    expect(text(step)).toContain(`The word was ${word}.`);
    expect(step.next).toBeUndefined();
  });

  it('accepts the whole word, and counts a wrong word as a miss', () => {
    expect(text(playThrough(start('hangman'), [word.toLowerCase()]))).toContain('You got it');
    const missed = playThrough(start('hangman'), [word.slice(0, 3)]);
    expect(text(missed)).toContain(`misses: ${word.slice(0, 3)}`);
  });

  it('does not charge for repeats or junk', () => {
    expect(text(playThrough(start('hangman'), [wrong[0] ?? '', wrong[0] ?? '']))).toContain(
      'Already tried',
    );
    expect(text(playThrough(start('hangman'), ['1']))).toContain('One letter');
  });
});

describe('tictactoe', () => {
  const careful = () => 0.5; // never blunders, takes the first best move

  it('spots a winner in rows, columns and diagonals', () => {
    expect(winner(['X', 'X', 'X', null, null, null, null, null, null])).toBe('X');
    expect(winner(['O', null, null, 'O', null, null, 'O', null, null])).toBe('O');
    expect(winner(['X', null, null, null, 'X', null, null, null, 'X'])).toBe('X');
    expect(winner(Array<null>(9).fill(null))).toBeNull();
  });

  it('takes a win and blocks a loss', () => {
    const canWin: Board = ['O', 'O', null, 'X', 'X', null, 'X', null, null];
    expect(machineMove(canWin, careful)).toBe(2);
    const mustBlock: Board = ['X', 'X', null, null, 'O', null, null, null, null];
    expect(machineMove(mustBlock, careful)).toBe(2);
  });

  it('plays a full game to a result', () => {
    let session: Session | undefined = start('tictactoe', careful);
    let step: SessionStep = { lines: [] };
    for (const cell of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      if (!session) break;
      const attempt = session.input(cell);
      if (text(attempt).includes('taken')) continue;
      step = attempt;
      session = attempt.next;
    }
    expect(session).toBeUndefined();
    expect(text(step)).toMatch(/You win!|I win\.|A draw\./);
  });

  it('rejects taken and invalid cells', () => {
    const session = start('tictactoe', careful);
    const afterFirst = session.input('5').next;
    expect(text(afterFirst?.input('5') ?? { lines: [] })).toContain('taken');
    expect(text(session.input('0'))).toContain('from 1 to 9');
  });
});
