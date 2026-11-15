import { describe, expect, it } from 'vitest';
import { playtime, toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute, findCommand } from '../index';
import type { CommandContext, Session, SessionStep } from '../types';
import { blockedZones, strike } from './fight/combat';
import type { Stats } from './fight/combat';
import { choose } from './fight/index';
import { HERO, RIVALS } from './fight/roster';
import { MAX_MISSES, WORDS } from './hangman';
import { LADDER, kept } from './millionaire/index';
import { TOPICS } from './millionaire/questions';
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

  it('draws the touchdown, and holds the verdict until the craft is down', () => {
    const step = playThrough(start('lander'), Array<string>(20).fill('0'));
    const picture = step.lines.filter((entry) => entry.art);
    expect(picture.at(-1)?.frames?.[0]?.spans[0]?.text).toBe('_'.repeat(21));
    expect(toPlainText(picture.at(-1) ?? { spans: [] })).toContain('\\___/');

    const wait = Math.max(...picture.map(playtime));
    const verdict = step.lines.find((entry) => toPlainText(entry).startsWith('Contact at'));
    expect(verdict?.frames).toEqual([{ spans: [], ms: wait }]);
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

  it('leaves the loser swinging, and the winner alone', () => {
    const lost = playThrough(start('hangman'), wrong.slice(0, MAX_MISSES));
    const drawing = lost.lines.filter((entry) => entry.art);
    expect(drawing.every((row) => row.loop && row.frames?.length === 4)).toBe(true);
    const head = drawing[2]?.frames?.map(({ spans }) => spans[0]?.text.indexOf('O'));
    expect(head).toEqual([2, 3, 2, 1]);

    const won = playThrough(start('hangman'), letters);
    expect(won.lines.some((entry) => entry.frames)).toBe(false);
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

  it('blinks the three in a row that won', () => {
    // The machine always takes the lowest free cell: X wins on the diagonal 3-5-7.
    const lazy = () => 0;
    const step = playThrough(start('tictactoe', lazy), ['3', '5', '7']);
    expect(text(step)).toContain('You win!');
    const rows = step.lines.filter((entry) => entry.frames);
    expect(rows).toHaveLength(5);
    const tones = rows[0]?.frames?.map(
      ({ spans }) => spans.find((span) => span.text === 'X')?.tone,
    );
    expect(tones).toEqual(['dim', 'bright', 'dim', 'bright', 'dim', 'bright']);
  });

  it('rejects taken and invalid cells', () => {
    const session = start('tictactoe', careful);
    const afterFirst = session.input('5').next;
    expect(text(afterFirst?.input('5') ?? { lines: [] })).toContain('taken');
    expect(text(session.input('0'))).toContain('from 1 to 9');
  });
});

describe('fight', () => {
  const even: Stats = { strength: 10, agility: 5, intuition: 5, endurance: 10 };
  /** Dice that come up as scripted, then keep repeating the last face. */
  const rolls = (...faces: number[]) => {
    let at = 0;
    return () => faces[Math.min(at++, faces.length - 1)] ?? 0;
  };
  // With every roll high nobody dodges or crits, blows do full damage, and the
  // rival always hits the legs and covers legs+head.
  const high = () => 0.99;
  const enter = (random: () => number): Session => {
    const ring = start('fight', random).input('').next;
    if (!ring) throw new Error('the ring did not open');
    return ring;
  };
  /** Repeats one move, walking through the breaks, until the evening ends. */
  const slog = (move: string): SessionStep => {
    let session: Session | undefined = enter(high);
    let step: SessionStep = { lines: [] };
    for (let turn = 0; session && turn < 500; turn += 1) {
      step = session.input(session.prompt.startsWith('press') ? '' : move);
      session = step.next;
    }
    return step;
  };

  it('builds the hero from the résumé', () => {
    for (const value of Object.values(HERO.stats)) expect(value).toBeGreaterThan(0);
    expect(HERO.moves.length).toBeGreaterThan(0);
  });

  it('a block covers the zone and the one below, wrapping from legs to head', () => {
    expect(blockedZones(0)).toEqual([0, 1]);
    expect(blockedZones(4)).toEqual([4, 0]);
  });

  it('resolves a blow: dodge, block, hit, critical, and a critical through a block', () => {
    expect(strike(even, even, 0, 2, rolls(0))).toEqual({ kind: 'dodged', damage: 0 });
    expect(strike(even, even, 2, 2, rolls(0.99))).toEqual({ kind: 'blocked', damage: 0 });
    expect(strike(even, even, 0, 2, rolls(0.99, 0.99, 0))).toEqual({ kind: 'hit', damage: 10 });
    expect(strike(even, even, 0, 2, rolls(0.99))).toEqual({ kind: 'hit', damage: 15 });
    expect(strike(even, even, 0, 2, rolls(0.99, 0, 0))).toEqual({ kind: 'critical', damage: 20 });
    expect(strike(even, even, 3, 2, rolls(0.99, 0, 0))).toEqual({ kind: 'pierced', damage: 10 });
  });

  it('reads a move typed whole, in halves, by name or from the buttons', () => {
    expect(choose({}, '2 4')).toEqual({ hit: 1, block: 3 });
    expect(choose({}, '24')).toEqual({ hit: 1, block: 3 });
    expect(choose({}, 'head legs')).toEqual({ hit: 0, block: 4 });
    expect(choose({}, '2')).toEqual({ hit: 1 });
    expect(choose({ hit: 1 }, '4')).toEqual({ hit: 1, block: 3 });
    expect(choose({ hit: 1 }, 'hit 5')).toEqual({ hit: 4 });
    expect(choose({}, 'block 3')).toEqual({ block: 2 });
    for (const junk of ['', '6', '0', '1 2 3', 'hit', 'block 9', 'punch']) {
      expect(choose({}, junk), junk).toBeUndefined();
    }
  });

  it('asks for the block after the hit, and rejects junk without losing the choice', () => {
    const aimed = enter(high).input('2');
    expect(text(aimed)).toContain('Aiming at the chest');
    expect(aimed.next?.prompt).toBe('block 1-5>');

    const junk = aimed.next?.input('nope');
    expect(text(junk ?? { lines: [] })).toContain('Zones are 1-5');
    expect(junk?.next?.prompt).toBe('block 1-5>');
  });

  it('strikes first, then takes the answer', () => {
    // The chest is open and the hero's legs are not covered: both blows land in full.
    const step = enter(high).input('2 1');
    const [first] = RIVALS;
    const answer = Math.floor((first?.stats.strength ?? 0) * 1.5);
    expect(text(step)).toContain(`on ${first?.name}'s chest.  -`);
    expect(text(step)).toContain(`on your legs.  -${answer} HP`);
    expect(step.next?.prompt).toBe('hit 1-5>');
  });

  it('beating every candidate wins the offer', () => {
    // Hits the open chest, covers the legs the rival keeps kicking.
    const step = slog('2 4');
    expect(text(step)).toContain('OFFER');
    expect(text(step)).toContain(`CANDIDATE ${RIVALS.length}/${RIVALS.length}`);
    expect(step.next).toBeUndefined();
  });

  it('hands over the loot and some health between bouts', () => {
    let session: Session | undefined = enter(high);
    let step: SessionStep = { lines: [] };
    while (session && !session.prompt.startsWith('press')) {
      step = session.input('2 1');
      session = step.next;
    }
    expect(text(step)).toContain(RIVALS[0]?.loot?.name);
    expect(text(step)).toMatch(/restores \d+ HP/);
    expect(text(session?.input('') ?? { lines: [] })).toContain('CANDIDATE 2/');
  });

  it('losing ends in a rejection letter', () => {
    // Hits the covered legs and leaves its own open.
    const step = slog('5 1');
    expect(text(step)).toContain('REJECTED');
    expect(text(step)).toContain('HP [........] 0/');
    expect(step.next).toBeUndefined();
  });

  it('draws the ring as wide as the banner, on a clean screen', () => {
    const picture = start('fight')
      .input('')
      .lines.filter((entry) => entry.art);
    expect(picture[0]?.clear).toBe(true);
    for (const row of picture) expect(toPlainText(row)).toHaveLength(54);
  });

  it('animates an exchange in place: every frame is a whole ring, the log shows as blows land', () => {
    const step = enter(high).input('2 1');
    const picture = step.lines.filter((entry) => entry.art);
    expect(picture).toHaveLength(11);
    for (const row of picture) {
      // Two swings of four moments each.
      expect(row.frames).toHaveLength(8);
      for (const frame of row.frames ?? []) {
        expect(frame.spans.map((span) => span.text).join('')).toHaveLength(54);
      }
    }
    const shown = (moment: number): string =>
      picture.map((row) => row.frames?.[moment]?.spans.map((span) => span.text).join('')).join('|');
    expect(shown(2)).toContain('-16');
    expect(shown(6)).toMatch(/-\d+/);

    const [mine, theirs] = step.lines.filter((entry) => !entry.art && entry.frames);
    expect(mine?.frames?.[0]).toEqual({ spans: [], ms: 160 });
    expect(theirs?.frames?.[0]?.ms).toBeGreaterThan(160);
  });

  it('lays the loser on the floor', () => {
    const step = slog('5 1');
    const floor = step.lines.filter((entry) => entry.art).map(toPlainText);
    expect(floor.join('|')).toContain('K.O.');
    expect(floor.join('|')).toContain('o-|--<');
  });

  it('keeps its buttons to itself: none of them is a shell command', () => {
    const step = start('fight').input('');
    const buttons = step.lines.flatMap(({ spans }) => spans.flatMap((span) => span.command ?? []));
    expect(buttons).toHaveLength(10);
    for (const button of [...buttons, 'next']) {
      expect(findCommand(button.split(' ')[0] ?? ''), button).toBeUndefined();
    }
  });
});

describe('millionaire', () => {
  const everything = TOPICS.flatMap(({ questions }) => questions);

  /** The letter of the right answer to the question on the screen. */
  const rightLetter = (step: SessionStep): string => {
    const shown = text(step);
    const question = everything.find(({ ask }) => shown.includes(ask));
    const row = step.lines.find((entry) =>
      toPlainText(entry).endsWith(`  ${question?.options[0]}`),
    );
    if (!row?.command) throw new Error('no right answer on the screen');
    return row.command;
  };
  const wrongLetter = (step: SessionStep): string =>
    ['a', 'b', 'c', 'd'].find((entry) => entry !== rightLetter(step)) ?? '';

  const begin = (topic = 'design', random: () => number = () => 0): SessionStep => {
    const { lines, session } = execute(`millionaire ${topic}`, contextWith(random));
    return { lines, next: session };
  };
  /** Answers `count` questions rightly and returns the screen that follows. */
  const climb = (count: number, from: SessionStep = begin()): SessionStep => {
    let step = from;
    for (let answered = 0; answered < count; answered += 1) {
      step = step.next?.input(rightLetter(step)) ?? { lines: [] };
    }
    return step;
  };

  it('has enough sound questions of every tier in every subject', () => {
    for (const { key, questions } of TOPICS) {
      for (const tier of [1, 2, 3]) {
        const count = questions.filter((question) => question.tier === tier).length;
        expect(count, `${key}, tier ${tier}`).toBeGreaterThanOrEqual(5);
      }
    }
    for (const { ask, options, why } of everything) {
      expect(new Set(options).size, ask).toBe(4);
      expect(why.length, ask).toBeGreaterThan(0);
    }
    const subjects = TOPICS.filter(({ key }) => key !== 'mix').flatMap(
      ({ questions }) => questions,
    );
    expect(new Set(subjects.map(({ ask }) => ask)).size).toBe(subjects.length);
  });

  it('offers the subjects when started without one, and knows a wrong one', () => {
    const menu = execute(
      'millionaire',
      contextWith(() => 0),
    );
    expect(menu.session).toBeUndefined();
    expect(menu.lines.flatMap((entry) => entry.command ?? [])).toEqual(
      TOPICS.map(({ key }) => `millionaire ${key}`),
    );
    expect(
      text(
        execute(
          'millionaire cobol',
          contextWith(() => 0),
        ),
      ),
    ).toContain('no subject "cobol"');
  });

  it('asks fifteen questions, easy ones first, and pays a million for all of them', () => {
    for (const { key } of TOPICS) {
      const step = climb(
        LADDER.length,
        begin(key, () => 0.37),
      );
      expect(text(step), key).toContain('$1,000,000');
      expect(step.next, key).toBeUndefined();
    }
    expect(text(begin())).toContain('QUESTION 1/15   for $100');
    expect(text(climb(5))).toContain('QUESTION 6/15   for $2,000   safe: $1,000');
    expect(text(climb(5))).toContain('$1,000 is now safe');
  });

  it('a wrong answer keeps only the last safe sum', () => {
    expect([0, 4, 5, 9, 10, 14].map(kept)).toEqual([0, 0, 1000, 1000, 32000, 32000]);

    const first = begin();
    const lost = first.next?.input(wrongLetter(first)) ?? { lines: [] };
    expect(text(lost)).toContain('Wrong. The answer was');
    expect(text(lost)).toContain('You leave with $0.');
    expect(lost.next).toBeUndefined();

    const sixth = climb(5);
    expect(text(sixth.next?.input(wrongLetter(sixth)) ?? { lines: [] })).toContain(
      'You leave with $1,000.',
    );
  });

  it('lets the player walk with what is won, but not before the first answer', () => {
    expect(text(begin().next?.input('walk') ?? { lines: [] })).toContain('Nothing to take yet');
    const left = climb(3).next?.input('walk');
    expect(text(left ?? { lines: [] })).toContain('You take the money: $300.');
    expect(left?.next).toBeUndefined();
  });

  it('50:50 leaves the right answer and one other, once', () => {
    const first = begin();
    const halved = first.next?.input('50:50') ?? { lines: [] };
    const left = halved.lines.flatMap((entry) => (entry.hang ? (entry.command ?? []) : []));
    expect(left).toHaveLength(2);
    expect(left).toContain(rightLetter(first));

    const gone = ['a', 'b', 'c', 'd'].find((entry) => !left.includes(entry)) ?? '';
    expect(text(halved.next?.input(gone) ?? { lines: [] })).toContain('That answer is gone');
    expect(text(halved.next?.input('50') ?? { lines: [] })).toContain('That lifeline is spent');
  });

  it('a senior names an answer and the audience votes add up to 100', () => {
    const first = begin();
    const called = first.next?.input('call') ?? { lines: [] };
    expect(text(called)).toContain(`"Easy. It is ${rightLetter(first).toUpperCase()}."`);

    const polled = called.next?.input('poll') ?? { lines: [] };
    const shares = [...text(polled).matchAll(/(\d+)%/g)].map(([, share]) => Number(share));
    expect(shares).toHaveLength(4);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
    expect(Math.max(...shares)).toBeGreaterThanOrEqual(60);
    expect(text(polled.next?.input('call') ?? { lines: [] })).toContain('That lifeline is spent');
  });

  it('holds the verdict and the next question back for a drum roll', () => {
    const first = begin();
    const step = first.next?.input(rightLetter(first)) ?? { lines: [] };
    const [verdict, ...rest] = step.lines;
    const roll = verdict?.frames?.map(({ spans }) => spans.map((span) => span.text).join(''));
    expect(roll?.[0]).toBe(`Final answer: ${rightLetter(first).toUpperCase()}`);
    expect(roll?.at(-1)).toMatch(/ \. \. \.$/);
    expect(verdict && toPlainText(verdict)).toContain('Correct.');

    const wait = verdict ? playtime(verdict) : 0;
    const question = rest.find((entry) => toPlainText(entry).includes('QUESTION 2/15'));
    expect(question?.frames?.[0]).toEqual({ spans: [], ms: wait });
  });

  it('rains money on a millionaire, for ever', () => {
    const rain = climb(LADDER.length).lines.filter((entry) => entry.loop);
    expect(rain.length).toBeGreaterThan(0);
    for (const row of rain) expect(row.art).toBe(true);
  });

  it('rejects anything that is not an answer without ending the game', () => {
    for (const junk of ['', 'e', '5', 'constructor']) {
      const step = begin().next?.input(junk);
      expect(text(step ?? { lines: [] }), junk).toContain('Answer A, B, C or D');
      expect(step?.next, junk).toBeDefined();
    }
  });

  it('keeps its buttons to itself: none of them is a shell command', () => {
    const buttons = climb(1).lines.flatMap(({ spans }) =>
      spans.flatMap((span) => span.command ?? []),
    );
    expect(buttons).toHaveLength(8);
    for (const button of buttons) expect(findCommand(button), button).toBeUndefined();
  });
});
