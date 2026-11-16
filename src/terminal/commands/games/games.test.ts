import { describe, expect, it } from 'vitest';
import { playtime, toPlainText } from '../../line';
import { DEFAULT_SETTINGS } from '../../settings';
import { execute, findCommand } from '../index';
import type { CommandContext, Session, SessionStep } from '../types';
import { CHESTS as DUNGEON_CHESTS, MAX_HEALTH } from './dungeon/index';
import { PLAN } from './dungeon/maze';
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

describe('dungeon', () => {
  /** Lights the torch, then walks: a count before a word repeats it. */
  const delve = (random: () => number, route: string): SessionStep =>
    playThrough(start('dungeon', random), [
      '',
      ...route
        .split(' ')
        .filter(Boolean)
        .flatMap((word) => {
          const [, times = '1', move = ''] = /^(\d*)(.+)$/.exec(word) ?? [];
          return Array.from({ length: Number(times || 1) }, () => move);
        }),
    ]);

  const pictures = (step: SessionStep): string[] =>
    step.lines.flatMap(({ image }) => (image ? [image.alt] : []));

  // Every roll at its highest: the hero hits hardest and no dweller ever lands a blow.
  const lucky = (): number => 0.99;
  const TO_THE_KEY = 'right 6forward left forward 3attack 2forward open';
  const TO_THE_DOOR =
    'back 3forward right 6forward right 2forward 2attack 4forward right 4forward ' +
    'left 2forward right forward 3attack';

  it('shows the corridor ahead and the hero under it', () => {
    const lit = delve(lucky, '');
    // The passage south of the way in is at the hero's shoulder: out of the picture, but in the text.
    expect(pictures(lit)).toEqual([
      'A stone corridor running into the dark',
      expect.stringContaining('Portrait'),
      'Map of the dungeon walked so far',
    ]);
    expect(text(lit)).toContain(`HP      [##########] ${MAX_HEALTH}/${MAX_HEALTH}`);
    expect(text(lit)).toContain('The way leads ahead and right.');
  });

  it('turns to face a passage, never a wall, and offers only the moves that lead somewhere', () => {
    // The picture is of the cell ahead: the corridor just left is behind the hero's shoulder now.
    const turned = delve(lucky, 'right');
    expect(pictures(turned)[0]).toBe('A stone corridor running into the dark');
    expect(text(turned)).toContain('forward  left  back  map');

    // The way in has rock on its left; turning back is always possible.
    expect(text(delve(lucky, 'left'))).toBe('No way to the left: solid rock.');
    expect(text(delve(lucky, ''))).toContain('forward  right  back  map');
    expect(pictures(delve(lucky, 'back'))[0]).toBe('A dead end: a blank stone wall');
    // A step back from the rat: the way in is ahead, with its passage south on the left.
    expect(pictures(delve(lucky, 'forward back'))[0]).toBe(
      'A wall ahead and an archway on the left',
    );
    expect(text(delve(lucky, 'back forward'))).toBe('Solid rock that way.');
  });

  it('moves the pictures: a step, a turn, a blow given and a blow taken', () => {
    const scene = (step: SessionStep) => step.lines[0]?.image;
    const face = (step: SessionStep) => step.lines[1]?.image;

    // The first screen is drawn in line by line, portrait and all.
    expect(scene(delve(lucky, ''))).toMatchObject({ still: false });
    expect(scene(delve(lucky, ''))?.motion).toBeUndefined();
    expect(scene(delve(lucky, 'forward'))?.motion).toBe('advance');
    expect(scene(delve(lucky, 'right'))?.motion).toBe('right');
    expect(scene(delve(lucky, 'back'))?.motion).toBe('back');
    expect(face(delve(lucky, 'forward'))?.still).toBe(true);

    // A dweller is drawn in; struck, it flickers, then lunges as its blow lands.
    expect(scene(delve(() => 0, '2forward'))?.motion).toBeUndefined();
    const fought = delve(() => 0, '2forward attack');
    expect(scene(fought)).toMatchObject({ alt: 'A giant rat baring its teeth', motion: 'clash' });
    expect(scene(fought)?.after).toBeGreaterThan(0);
    expect(face(fought)).toMatchObject({ motion: 'shake', after: scene(fought)?.after });

    // Both bars run down to where they end up: the rat's at once, the hero's with the blow.
    const [, , , , hp, , , , rat] = fought.lines;
    expect(hp?.frames).toHaveLength(1);
    expect(rat?.frames).toHaveLength(2);
    expect(hp ? playtime(hp) : 0).toBeGreaterThan(scene(fought)?.after ?? 0);

    // A blow that misses moves the dweller, not the hero.
    expect(face(delve(lucky, '2forward attack'))?.still).toBe(true);
  });

  it('names the pictures one move away, to be fetched ahead of time', () => {
    const ahead = (step: SessionStep): number => step.lines[0]?.image?.upcoming?.length ?? 0;
    // From the way in, a step on and a turn right both look down a bare corridor, like the
    // picture already up; only the wall behind is new. Each picture is fetched once.
    expect(ahead(delve(lucky, ''))).toBe(1);
    // In a fight: the corridor on if the rat falls, the way in if the hero runs, and the worst case.
    expect(ahead(delve(lucky, '2forward'))).toBe(3);
    expect(ahead(delve(lucky, '2forward 2attack 3forward'))).toBeGreaterThan(0);
  });

  it('shows a chest or the fountain from a step away, not only from on top of it', () => {
    const chest = delve(lucky, 'right 6forward left forward 3attack forward');
    expect(pictures(chest)[0]).toBe('An iron-bound chest in an alcove');
    expect(text(chest)).toContain('A chest, and nobody guarding it. The way leads ahead.');
    expect(text(chest)).not.toContain('open  ');

    const fountain = delve(lucky, '2forward 2attack 2forward right 3forward');
    expect(pictures(fountain)[0]).toBe('A fountain running into a stone basin');
    expect(text(fountain)).toContain('Water runs into a stone basin ahead.');
  });

  it('closes the map on a second map, and offers a potion in a fight only when it would help', () => {
    expect(pictures(delve(lucky, 'map map'))[0]).toBe('A stone corridor running into the dark');

    expect(text(delve(lucky, '2forward'))).toContain('attack  flee');
    expect(text(delve(() => 0, '2forward attack'))).toContain('attack  drink  flee');
  });

  it('has a prize in every chest of the plan', () => {
    const cells = PLAN.flatMap((row, y) => [...row].map((tile, x) => ({ tile, x, y })));
    for (const { tile, x, y } of cells) {
      if (tile === 'c') expect(DUNGEON_CHESTS).toHaveProperty(`${x},${y}`);
    }
    expect(cells.filter(({ tile }) => tile === 'c')).toHaveLength(
      Object.keys(DUNGEON_CHESTS).length,
    );
  });

  it('warns of what waits in the dark, and fights it face to face', () => {
    expect(text(delve(lucky, 'forward'))).toContain('Something moves in the dark ahead.');

    const met = delve(lucky, '2forward');
    expect(pictures(met)[0]).toBe('A giant rat baring its teeth');
    expect(text(met)).toContain('GIANT RAT [##########] 6/6');

    const won = delve(lucky, '2forward 2attack');
    expect(text(won)).toContain('The rat squeals and lies still. +2 gold');
    expect(pictures(won)[0]).toBe('A stone corridor running into the dark');
  });

  it('keeps the door shut until the key is found', () => {
    const locked = delve(
      lucky,
      '2forward 2attack 4forward right 4forward left 2forward right forward 3attack',
    );
    expect(pictures(locked)[0]).toBe('A heavy wooden door at the end of the corridor');
    expect(text(locked)).toContain('It is locked.');
    expect(text(playThrough(locked.next ?? start('dungeon'), ['forward']))).toContain('Locked.');

    const chest = delve(lucky, TO_THE_KEY);
    expect(text(chest)).toContain('Inside: 15 gold, a healing potion and an iron key.');
    expect(text(chest)).toContain('The chest stands open and empty.');
  });

  it('is won by climbing the stairs behind the minotaur', () => {
    const opened = delve(lucky, `${TO_THE_KEY} ${TO_THE_DOOR} forward`);
    expect(text(opened)).toContain('The key turns, and the door groans open.');

    const stairs = delve(lucky, `${TO_THE_KEY} ${TO_THE_DOOR} forward right forward 6attack`);
    expect(pictures(stairs)[0]).toBe('Stairs climbing towards daylight');

    const out = delve(lucky, `${TO_THE_KEY} ${TO_THE_DOOR} forward right forward 6attack forward`);
    expect(pictures(out)).toEqual(['Sunrise over the hills, seen from the mouth of a cave']);
    expect(text(out)).toContain('DAYLIGHT.');
    expect(text(out)).toContain('65 gold');
    expect(out.next).toBeUndefined();
  });

  it('lets the hero run, at a price, and die of it', () => {
    // Every roll at its lowest: the parting blow always lands, for the least damage.
    const fled = delve(() => 0, '2forward flee');
    expect(text(fled)).toContain('You back away, and run.');
    expect(text(fled)).toContain(`${MAX_HEALTH - 1}/${MAX_HEALTH}`);
    expect(pictures(fled)[0]).toBe('A wall ahead and an archway on the left');

    const dead = delve(
      () => 0,
      `2forward flee ${'back forward flee '.repeat(MAX_HEALTH - 1).trim()}`,
    );
    expect(pictures(dead)).toEqual(['A skull and a dropped sword on the floor']);
    expect(text(dead)).toContain('YOU DIED. The giant rat keeps the torch.');
    expect(dead.next).toBeUndefined();
  });

  it('heals at the fountain and from the bottle, and draws the map as it goes', () => {
    const hurt = '2forward flee back forward flee';
    const potion = delve(() => 0, `${hurt} drink`);
    expect(text(potion)).toContain(`${MAX_HEALTH}/${MAX_HEALTH}`);
    expect(text(potion)).toContain('POTIONS 0');

    expect(text(delve(lucky, '2forward 2attack 2forward right 4forward drink'))).toContain(
      'You drink from the fountain',
    );
  });

  it('draws the map as a picture of what was walked and seen, and no more', () => {
    const drawn = (step: SessionStep, at = 0): string =>
      decodeURIComponent(step.lines[at]?.image?.src.split(',')[1] ?? '');
    const walls = (svg: string): number => svg.split('opacity="0.9"').length - 1;

    // In the corner of a broad screen, at every step.
    const lit = delve(lucky, '');
    expect(lit.lines[2]).toMatchObject({ screen: 'broad', image: { side: 'right' } });
    // The way in, the two cells seen from it, and the rock that closes them in.
    expect(walls(drawn(lit, 2))).toBe(10);
    expect(drawn(lit, 2).split('opacity="0.3"')).toHaveLength(2);
    expect(drawn(lit, 2).split('opacity="0.12"')).toHaveLength(3);

    // In place of the scene on `map`; it grows with every step and never shows the unseen.
    const map = delve(lucky, 'forward map');
    expect(pictures(map)[0]).toBe('Map of the dungeon walked so far');
    expect(walls(drawn(map))).toBeGreaterThan(walls(drawn(lit, 2)));
    expect(drawn(map)).not.toContain('<circle');
    expect(drawn(delve(lucky, '2forward 2attack 2forward right 4forward map'))).toContain(
      '<circle',
    );

    // Any move brings the scene back.
    const on = playThrough(map.next ?? start('dungeon'), ['back']);
    expect(pictures(on)[0]).toBe('A wall ahead and an archway on the left');
  });
});
