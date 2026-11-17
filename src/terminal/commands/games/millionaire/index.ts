/**
 * `millionaire`: fifteen questions on the way to a million, after the TV
 * quiz, on system design, Node.js, Python and C#. The questions live in
 * `questions` and `topics/`; this file runs the show.
 */
import { action, blank, bright, cued, dim, heading, later, line } from '../../../line';
import type { Line, Span } from '../../../line';
import type { Command, Session, SessionStep } from '../../types';
import { pick, playAgain, quitHint } from '../shared';
import { TOPICS } from './questions';
import type { Question, Tier, Topic } from './questions';

export const LADDER = [
  100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000,
  1_000_000,
] as const;

/** Questions (counted from zero) whose sum is kept whatever happens later. */
const SAFE = [4, 9] as const;
const PER_TIER = 5;
const TIERS: readonly Tier[] = [1, 2, 3];
const LETTERS = ['A', 'B', 'C', 'D'] as const;

type Lifeline = 'fifty' | 'call' | 'poll';

const LIFELINES: readonly { key: Lifeline; command: string; label: string }[] = [
  { key: 'fifty', command: '50:50', label: '50:50' },
  { key: 'call', command: 'call', label: 'call a senior' },
  { key: 'poll', command: 'poll', label: 'ask the audience' },
];

/** How often the senior on the phone is right, by tier. */
const SENIOR_RIGHT: Readonly<Record<Tier, number>> = { 1: 0.95, 2: 0.8, 3: 0.6 };
const SENIOR_SAYS: Readonly<Record<Tier, string>> = {
  1: 'Easy. It is',
  2: 'I am fairly sure it is',
  3: 'Honestly? I would go with',
};
/** The least share of the audience that votes for the right answer, in percent. */
const AUDIENCE_RIGHT: Readonly<Record<Tier, number>> = { 1: 60, 2: 45, 3: 32 };
const AUDIENCE_SWING = 20;
const BAR = 20;

/** The pause before a verdict: "Final answer: B . . ." */
const DOTS = ['', ' .', ' . .', ' . . .'] as const;
const DOT_MS = 280;
const SUSPENSE_MS = DOTS.length * DOT_MS;
/** The audience's bars grow to their size in this many steps. */
const VOTE_STEPS = 6;
const VOTE_MS = 90;
/** Money falling on the winner: rows of it, and patterns to cycle through. */
const RAIN = { rows: 4, width: 44, patterns: 7, ms: 170 } as const;

/** A question as it is put to the player: the options in their shuffled order. */
interface Asked {
  tier: Tier;
  ask: string;
  options: readonly string[];
  /** Index of the right option. */
  right: number;
  why: string;
}

interface Game {
  topic: Topic;
  asked: readonly Asked[];
  /** Index of the current question. */
  at: number;
  lifelines: readonly Lifeline[];
  /** Options of the current question taken away by 50:50. */
  hidden: readonly number[];
  random: () => number;
}

const money = (sum: number): string => `$${sum.toLocaleString('en-US')}`;

const shuffle = <T>(random: () => number, items: readonly T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    const held = result[index] as T;
    result[index] = result[other] as T;
    result[other] = held;
  }
  return result;
};

const put = (random: () => number, { tier, ask, options, why }: Question): Asked => {
  const order = shuffle(
    random,
    options.map((_, index) => index),
  );
  return {
    tier,
    ask,
    options: order.map((index) => options[index] ?? ''),
    right: order.indexOf(0),
    why,
  };
};

/** Five questions of each tier, the easy ones first. */
const draw = (random: () => number, questions: readonly Question[]): Asked[] =>
  TIERS.flatMap((tier) =>
    shuffle(
      random,
      questions.filter((question) => question.tier === tier),
    )
      .slice(0, PER_TIER)
      .map((question) => put(random, question)),
  );

const current = ({ asked, at }: Game): Asked => {
  const question = asked[at];
  if (!question) throw new Error(`millionaire: no question ${at}`);
  return question;
};

const sumAt = (index: number): number => LADDER[index] ?? 0;

/** What a wrong answer to question `at` leaves: the last safe sum passed. */
export const kept = (at: number): number => sumAt(SAFE.findLast((index) => index < at) ?? -1);

/** What walking away from question `at` pays: the last sum won. */
const won = (at: number): number => sumAt(at - 1);

const letter = (index: number): string => LETTERS[index] ?? '?';

const answerText = ({ options, right }: Asked): string =>
  `${letter(right)}: ${options[right] ?? ''}`;

const OPTION_INDENT = 5;

const optionRow = (text: string, index: number, gone: boolean): Line => {
  const command = letter(index).toLowerCase();
  if (gone) return line(dim(`  ${letter(index)}  -`));
  return {
    spans: [{ text: '  ' }, action(command, letter(index)), { text: `  ${text}` }],
    hang: OPTION_INDENT,
    command,
  };
};

const SEPARATOR = '  ·  ';

/** The lifelines still unused, and the way out with the money. */
const actions = ({ lifelines, at }: Game): Line => {
  const buttons: Span[] = [
    ...LIFELINES.filter(({ key }) => lifelines.includes(key)).map(({ command, label }) =>
      action(command, label),
    ),
    ...(at > 0 ? [action('walk', `take ${money(won(at))} and walk`)] : []),
  ];
  return line(
    ...buttons.flatMap((button, index) => (index > 0 ? [dim(SEPARATOR), button] : [button])),
  );
};

/**
 * The question on a clean screen, under whatever was just said. With `wait`
 * it stays dark for that long, while the lines above play out.
 */
const screen = (game: Game, above: readonly Line[], wait = 0): Line[] => {
  const { ask, options } = current(game);
  const lines: Line[] = [
    ...above,
    ...later(wait, [
      line(
        { text: ` QUESTION ${game.at + 1}/${LADDER.length} `, tone: 'inverse' },
        '  for ',
        bright(money(sumAt(game.at))),
        dim(`   safe: ${money(kept(game.at))}`),
      ),
      blank(),
      line(ask),
      blank(),
      ...options.map((text, index) => optionRow(text, index, game.hidden.includes(index))),
      blank(),
      actions(game),
    ]),
  ];
  const [top, ...rest] = lines;
  return top ? [{ ...top, clear: true }, ...rest] : [];
};

const ask = (game: Game, above: readonly Line[], wait = 0): SessionStep => ({
  lines: screen(game, above, wait),
  next: round(game),
});

/** A row that counts dots after `lead` before it turns into `verdict`. */
const suspense = (lead: readonly Span[], verdict: Line): Line => ({
  ...verdict,
  frames: DOTS.map((dots) => ({ spans: [...lead, dim(dots)], ms: DOT_MS })),
});

const finalAnswer = (choice: number, verdict: Line): Line =>
  suspense([dim('Final answer: '), bright(letter(choice))], verdict);

/** Money falling down the screen, for as long as the winner cares to watch. */
const rain = (random: () => number): Line[] => {
  const drop = (): string => {
    const roll = random();
    return roll < 0.08 ? '$' : roll < 0.14 ? '*' : roll < 0.2 ? '.' : ' ';
  };
  const patterns = Array.from({ length: RAIN.patterns }, () =>
    Array.from({ length: RAIN.width }, drop).join(''),
  );
  // Every frame each pattern is one row lower.
  const at = (frame: number, row: number): Span =>
    bright(patterns[(row - frame + RAIN.patterns) % RAIN.patterns] ?? '');

  return Array.from({ length: RAIN.rows }, (_, row) => ({
    spans: [at(0, row)],
    frames: patterns.map((_, frame) => ({ spans: [at(frame, row)], ms: RAIN.ms })),
    loop: true,
    art: true,
  }));
};

const replay = ({ topic }: Game): Line => playAgain(`millionaire ${topic.key}`);

const lose = (game: Game, choice: number): SessionStep => {
  const question = current(game);
  return {
    lines: [
      finalAnswer(
        choice,
        cued('lose', line('Wrong. The answer was ', bright(answerText(question)), '.')),
      ),
      ...later(SUSPENSE_MS, [
        line(dim(question.why)),
        blank(),
        line('You leave with ', bright(money(kept(game.at))), '.'),
        blank(),
        replay(game),
      ]),
    ],
  };
};

const walk = (game: Game): SessionStep => {
  const question = current(game);
  return {
    lines: [
      cued('coin', line('You take the money: ', bright(money(won(game.at))), '.')),
      line(dim(`For the record, the answer was ${answerText(question)}. ${question.why}`)),
      blank(),
      replay(game),
    ],
  };
};

const win = (game: Game, choice: number): SessionStep => ({
  lines: [
    finalAnswer(choice, cued('win', line(bright('Correct. '), current(game).why))),
    ...later(SUSPENSE_MS, [
      blank(),
      ...rain(game.random),
      heading('millionaire'),
      line(
        bright(money(sumAt(LADDER.length - 1))),
        `. All ${LADDER.length}, in ${game.topic.title}.`,
      ),
      blank(),
      line(dim('The author answers these for a living: '), action('contact')),
      replay(game),
    ]),
  ],
});

const correct = (game: Game, choice: number): SessionStep => {
  if (game.at === LADDER.length - 1) return win(game, choice);

  const safe = SAFE.some((index) => index === game.at);
  const next: Game = { ...game, at: game.at + 1, hidden: [] };
  // A sum made safe rings up like money in the bank.
  const verdict = cued(
    safe ? 'coin' : 'right',
    line(
      bright('Correct. '),
      current(game).why,
      ...(safe ? [bright(` ${money(sumAt(game.at))} is now safe.`)] : []),
    ),
  );
  return ask(next, [finalAnswer(choice, verdict), blank()], SUSPENSE_MS);
};

/** The options still on the board that are wrong. */
const wrongOnes = (game: Game): number[] => {
  const { options, right } = current(game);
  return options.flatMap((_, index) =>
    index === right || game.hidden.includes(index) ? [] : [index],
  );
};

const spend = (game: Game, lifeline: Lifeline): Game => ({
  ...game,
  lifelines: game.lifelines.filter((key) => key !== lifeline),
});

const fifty = (game: Game): SessionStep => {
  const hidden = shuffle(game.random, wrongOnes(game)).slice(0, 2);
  return ask({ ...spend(game, 'fifty'), hidden }, [
    line(dim('50:50: two wrong answers are gone.')),
    blank(),
  ]);
};

const call = (game: Game): SessionStep => {
  const { tier, right } = current(game);
  const said = game.random() < SENIOR_RIGHT[tier] ? right : pick(game.random, wrongOnes(game));
  const advice = line(
    dim('A senior picks up: '),
    `"${SENIOR_SAYS[tier]} `,
    bright(letter(said)),
    '."',
  );
  return ask(spend(game, 'call'), [suspense([dim('Calling a senior')], advice), blank()]);
};

/** Shares of the vote in percent, one per option; they add up to 100. */
const votes = (game: Game): number[] => {
  const { tier, options, right } = current(game);
  const wrong = wrongOnes(game);
  const forRight = Math.round(AUDIENCE_RIGHT[tier] + game.random() * AUDIENCE_SWING);
  const weights = wrong.map(() => game.random() + 0.1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const shares = options.map(() => 0);
  wrong.forEach((option, index) => {
    shares[option] = Math.floor(((100 - forRight) * (weights[index] ?? 0)) / total);
  });
  // Whatever rounding left over goes to the right answer.
  shares[right] = 100 - shares.reduce((sum, share) => sum + share, 0);
  return shares;
};

const poll = (game: Game): SessionStep => {
  const shares = votes(game);
  const rows = shares.flatMap((share, index): Line[] => {
    if (game.hidden.includes(index)) return [];
    const filled = Math.round((share / 100) * BAR);
    const bar = (length: number): string => `${'#'.repeat(length)}${'.'.repeat(BAR - length)}`;
    const name = `  ${letter(index)}  `;
    return [
      {
        ...line(name, bar(filled), `  ${share}%`),
        // The votes come in: the bar grows, the figure shows once it has stopped.
        frames: Array.from({ length: VOTE_STEPS }, (_, step) => ({
          spans: [{ text: name }, { text: bar(Math.round((filled * step) / VOTE_STEPS)) }],
          ms: VOTE_MS,
        })),
      },
    ];
  });
  return ask(spend(game, 'poll'), [line(dim('The audience votes:')), ...rows, blank()]);
};

const LIFELINE_WORDS: ReadonlyMap<string, Lifeline> = new Map([
  ['50:50', 'fifty'],
  ['50', 'fifty'],
  ['5050', 'fifty'],
  ['fifty', 'fifty'],
  ['call', 'call'],
  ['senior', 'call'],
  ['poll', 'poll'],
  ['audience', 'poll'],
]);

const USE: Readonly<Record<Lifeline, (game: Game) => SessionStep>> = { fifty, call, poll };

const round = (game: Game): Session => ({
  prompt: 'answer a-d>',
  input: (text): SessionStep => {
    const word = text.toLowerCase();
    const again = (message: string): SessionStep => ({
      lines: [line(dim(message))],
      next: round(game),
    });

    const lifeline = LIFELINE_WORDS.get(word);
    if (lifeline) {
      return game.lifelines.includes(lifeline)
        ? USE[lifeline](game)
        : again('That lifeline is spent.');
    }

    if (word === 'walk' || word === 'take') {
      return game.at > 0 ? walk(game) : again('Nothing to take yet.');
    }

    // Letters, or 1-4 for a numeric keypad.
    const byLetter = LETTERS.findIndex((entry) => entry.toLowerCase() === word);
    const choice = byLetter >= 0 ? byLetter : Number(word) - 1;
    if (current(game).options[choice] === undefined) {
      return again('Answer A, B, C or D; or `50:50`, `call`, `poll`, `walk`.');
    }
    if (game.hidden.includes(choice)) return again('That answer is gone.');
    return choice === current(game).right ? correct(game, choice) : lose(game, choice);
  },
});

const TOPIC_COLUMN = Math.max(...TOPICS.map(({ key }) => key.length)) + 3;

const menu = (): Line[] => [
  heading('millionaire'),
  blank(),
  line(
    `${LADDER.length} questions, four answers each, ${money(sumAt(LADDER.length - 1))} at the top. `,
    `A wrong answer drops you to the last safe sum: ${SAFE.map((index) => money(sumAt(index))).join(' or ')}.`,
  ),
  line('Three lifelines: 50:50, a call to a senior, and the audience.'),
  blank(),
  line(dim('PICK A SUBJECT')),
  ...TOPICS.map(({ key, title, summary }): Line => {
    const command = `millionaire ${key}`;
    return {
      spans: [
        { text: '  ' },
        action(command, key),
        { text: ' '.repeat(TOPIC_COLUMN - key.length) },
        { text: `${title}. ` },
        dim(summary),
      ],
      hang: TOPIC_COLUMN + 2,
      command,
    };
  }),
];

export const millionaire: Command = {
  name: 'millionaire',
  summary: 'Fifteen tech questions between you and a million',
  music: 'millionaire',
  usage: `[${TOPICS.map(({ key }) => key).join('|')}]`,
  options: TOPICS.map(({ key }) => key),
  run: ([subject], { random }) => {
    if (subject === undefined) return { lines: menu() };

    const topic = TOPICS.find(({ key }) => key === subject.toLowerCase());
    if (!topic) {
      return {
        lines: [
          line(
            `millionaire: no subject "${subject}". Try `,
            ...TOPICS.flatMap(({ key }, index) => [
              ...(index > 0 ? [', '] : []),
              action(`millionaire ${key}`, key),
            ]),
          ),
        ],
      };
    }

    const game: Game = {
      topic,
      asked: draw(random, topic.questions),
      at: 0,
      lifelines: LIFELINES.map(({ key }) => key),
      hidden: [],
      random,
    };
    const first = ask(game, [line(dim(`Subject: ${topic.title}.`)), quitHint(), blank()]);
    return { lines: first.lines, session: first.next };
  },
};
