/**
 * `fight`: a turn-based brawl for a job offer, after the browser fight clubs
 * of the 2000s. The hero's stats come from the résumé; the opponents are the
 * other candidates. Rules live in `combat`, the cast in `roster`, the picture
 * in `arena`; this file runs the evening.
 */
import { profile } from '../../../../content/resume';
import { action, animated, blank, bright, bullet, dim, heading, later, line } from '../../../line';
import type { Line, Span } from '../../../line';
import type { Command, Session, SessionStep } from '../../types';
import { pick, playAgain, quitHint, randomInt } from '../shared';
import { arena } from './arena';
import type { Combatant, Pose, Poses } from './arena';
import { STAT_LABELS, ZONES, blockName, maxHealth, strike, withBonuses, zoneName } from './combat';
import type { Blow, BlowKind, Stats, Zone } from './combat';
import { HERO, HERO_STAT_SOURCES, RIVALS, STARTING_ITEMS } from './roster';
import type { Item, Rival } from './roster';

/** How often a rival aims at the favourite zone instead of a random one. */
const FAVOURITE_RATE = 0.5;

interface Bout {
  /** Index of the rival in `RIVALS`. */
  stage: number;
  hero: Combatant;
  rival: Combatant;
  items: readonly Item[];
  random: () => number;
}

/** What the player has chosen so far in this exchange. */
interface Choice {
  hit?: Zone;
  block?: Zone;
}

const rivalAt = (stage: number): Rival => {
  const rival = RIVALS[stage];
  if (!rival) throw new Error(`fight: no rival ${stage}`);
  return rival;
};

const heroWith = (items: readonly Item[]): Stats =>
  withBonuses(
    HERO.stats,
    items.map(({ bonus }) => bonus),
  );

const fresh = (
  stage: number,
  hero: Combatant,
  items: readonly Item[],
  random: () => number,
): Bout => {
  const rival = rivalAt(stage);
  return {
    stage,
    hero,
    rival: { fighter: rival, stats: rival.stats, health: maxHealth(rival.stats) },
    items,
    random,
  };
};

const bonusText = (bonus: Partial<Stats>): string =>
  (Object.keys(STAT_LABELS) as (keyof Stats)[])
    .flatMap((stat) => (bonus[stat] ? [`+${bonus[stat]} ${STAT_LABELS[stat]}`] : []))
    .join(' ');

const itemRow = ({ name, bonus, note }: Item): Line =>
  bullet(bright(name), dim(`  ${bonusText(bonus)}  `), note);

/** The zones as buttons: `hit 3` or `block 3`, so a click never depends on what was clicked before. */
const zoneButtons = (verb: 'hit' | 'block', label: (zone: Zone) => string): Line =>
  line(
    dim(verb.padEnd(7)),
    ...ZONES.flatMap((_, zone): (string | Span)[] => [
      ...(zone > 0 ? ['  '] : []),
      action(`${verb} ${zone + 1}`, `${zone + 1} ${label(zone)}`),
    ]),
  );

const controls = (): Line[] => [zoneButtons('hit', zoneName), zoneButtons('block', blockName)];

/** One moment of the animated ring. */
interface Scene {
  hero: Combatant;
  rival: Combatant;
  poses?: Poses;
  ms: number;
}

/** How the ring gets to the picture it ends on. */
interface Show {
  scenes: readonly Scene[];
  /** The poses it ends in, e.g. the loser on the floor. */
  poses?: Poses;
}

const STILL: Show = { scenes: [] };

/** Columns a fighter lunges forward, in two steps, and what each moment lasts. */
const LUNGE = 6;
const STEP_MS = 80;
const IMPACT_MS = 420;
/** When a blow lands, counted from the start of the swing; and the whole swing. */
const IMPACT_AT = STEP_MS * 2;
const SWING_MS = IMPACT_AT + IMPACT_MS + STEP_MS;
const KNOCKOUT_MS = 500;
const KNOCKED_OUT: Pose = { down: true, note: 'K.O.' };
/** Columns a new rival walks in from, and the time each step takes. */
const WALK_IN = [8, 6, 4, 2] as const;
const WALK_MS = 90;

const runtime = ({ scenes }: Show): number => scenes.reduce((total, { ms }) => total + ms, 0);

/** The ring on a clean screen, what just happened under it. */
const ring = (
  { stage, hero, rival }: Bout,
  log: readonly Line[],
  { scenes, poses }: Show = STILL,
): Line[] => {
  const title = `CANDIDATE ${stage + 1}/${RIVALS.length}`;
  const [top, ...rest] = animated(
    arena(hero, rival, title, poses),
    scenes.map((scene) => ({
      lines: arena(scene.hero, scene.rival, title, scene.poses),
      ms: scene.ms,
    })),
  );
  return [...(top ? [{ ...top, clear: true }] : []), ...rest, ...log];
};

const SHOUTS: Readonly<Record<BlowKind, (blow: Blow) => string>> = {
  dodged: () => 'MISS',
  blocked: () => 'BLOCK',
  hit: ({ damage }) => `-${damage}`,
  pierced: ({ damage }) => `-${damage}`,
  critical: ({ damage }) => `CRIT! -${damage}`,
};

/** How the one who is hit takes it; `away` is the direction of "back". */
const reaction = (blow: Blow, away: 1 | -1): Pose => ({
  note: SHOUTS[blow.kind](blow),
  shift: blow.kind === 'dodged' ? away * 4 : blow.damage > 0 ? away * 2 : 0,
});

/**
 * One swing: the attacker lunges, the blow lands and the health of the one
 * hit drops, the attacker steps back.
 */
const swing = (
  attacker: keyof Poses,
  blow: Blow,
  before: Bout,
  after: Bout,
  knockout: boolean,
): Scene[] => {
  const victim = attacker === 'hero' ? 'rival' : 'hero';
  const forward = attacker === 'hero' ? 1 : -1;
  const lunge = (step: number): Pose => ({ shift: (forward * LUNGE * step) / 2 });
  const took = reaction(blow, forward);
  const { hero, rival } = after;

  return [
    { ...before, poses: { [attacker]: lunge(1) }, ms: STEP_MS },
    { ...before, poses: { [attacker]: lunge(2) }, ms: STEP_MS },
    { hero, rival, poses: { [attacker]: lunge(2), [victim]: took }, ms: IMPACT_MS },
    { hero, rival, poses: { [attacker]: lunge(1), [victim]: { note: took.note } }, ms: STEP_MS },
    ...(knockout ? [{ hero, rival, poses: { [victim]: { note: 'K.O.' } }, ms: KNOCKOUT_MS }] : []),
  ];
};

const damage = (blow: Blow): Span => bright(`  -${blow.damage} HP`);

/** The hero's blow in words. Moves are skills from the résumé. */
const heroBlow = (blow: Blow, move: string, rival: string, zone: Zone): Line => {
  const place = zoneName(zone);
  switch (blow.kind) {
    case 'dodged':
      return line(`${rival} dodges your ${move}.`);
    case 'blocked':
      return line(`${rival} blocks your ${move} to the ${place}.`);
    case 'pierced':
      return line(`Your ${move} goes straight through ${rival}'s block.`, damage(blow));
    case 'critical':
      return line(
        bright('CRITICAL! '),
        `Your ${move} catches ${rival} right in the ${place}.`,
        damage(blow),
      );
    case 'hit':
      return line(`You land ${move} on ${rival}'s ${place}.`, damage(blow));
  }
};

const rivalBlow = (blow: Blow, move: string, rival: string, zone: Zone): Line => {
  const place = zoneName(zone);
  switch (blow.kind) {
    case 'dodged':
      return line(`You dodge ${move}.`);
    case 'blocked':
      return line(`You block ${move} aimed at your ${place}.`);
    case 'pierced':
      return line(`${rival} pushes ${move} straight through your block.`, damage(blow));
    case 'critical':
      return line(
        bright('CRITICAL! '),
        `${rival} catches you in the ${place} with ${move}.`,
        damage(blow),
      );
    case 'hit':
      return line(`${rival} lands ${move} on your ${place}.`, damage(blow));
  }
};

const firstName = profile.name.split(' ')[0] ?? profile.name;

const offer = (bout: Bout, log: readonly Line[], show: Show): SessionStep => ({
  lines: [
    ...ring(bout, log, show),
    ...later(runtime(show), [
      line(bright(bout.rival.fighter.name), ` ${rivalAt(bout.stage).defeat}`),
      blank(),
      heading('offer'),
      line(
        `"Dear ${firstName}, the other candidates are no longer available. When can you start?"`,
      ),
      blank(),
      line(
        dim('The real one hits deadlines just as hard, and needs no rubber duck: '),
        action('contact'),
      ),
      playAgain('fight'),
    ]),
  ],
});

const rejection = (bout: Bout, log: readonly Line[], show: Show): SessionStep => ({
  lines: [
    ...ring(bout, log, show),
    ...later(runtime(show), [
      blank(),
      heading('rejected'),
      line(
        '"Thank you for your interest. We have decided to move forward with ',
        bright(bout.rival.fighter.name),
        '. We will keep your résumé on file."',
      ),
      blank(),
      playAgain('fight'),
    ]),
  ],
});

/** Between bouts: the loot, a coffee, and a look at who is next. */
const interval = (bout: Bout, log: readonly Line[], show: Show): SessionStep => {
  const beaten = rivalAt(bout.stage);
  const items = beaten.loot ? [...bout.items, beaten.loot] : bout.items;
  const stats = heroWith(items);
  // A coffee break gives back half of what is missing.
  const rest = Math.ceil((maxHealth(stats) - bout.hero.health) / 2);
  const hero: Combatant = { ...bout.hero, stats, health: bout.hero.health + rest };
  const next = fresh(bout.stage + 1, hero, items, bout.random);
  const upcoming = rivalAt(next.stage);

  return {
    lines: [
      ...ring(bout, log, show),
      ...later(runtime(show), [
        line(bright(beaten.name), ` ${beaten.defeat}`),
        ...(beaten.loot ? [line(dim('You pick up:')), itemRow(beaten.loot)] : []),
        line(dim(`A coffee break restores ${rest} HP.`)),
        blank(),
        line(
          dim('Next in line: '),
          bright(upcoming.name),
          dim(`, ${upcoming.tagline.toLowerCase()}. `),
          action('next', 'Bring them in >'),
        ),
      ]),
    ],
    next: {
      prompt: 'press Enter>',
      input: () => entrance(next),
    },
  };
};

/** A new rival walks in from the far side of the ring. */
const entrance = (bout: Bout): SessionStep => {
  const { hero, rival } = bout;
  const show: Show = {
    scenes: WALK_IN.map((shift) => ({ hero, rival, poses: { rival: { shift } }, ms: WALK_MS })),
  };
  return {
    lines: [
      ...ring(bout, later(runtime(show), [line(dim(rivalAt(bout.stage).tell))]), show),
      blank(),
      ...controls(),
    ],
    next: round(bout),
  };
};

/** One exchange: the hero strikes first, the rival answers if still standing. */
const exchange = (bout: Bout, hit: Zone, block: Zone): SessionStep => {
  const { random, hero, rival } = bout;
  const { name, favours, moves } = rivalAt(bout.stage);
  const lastZone = ZONES.length - 1;
  const aim = random() < FAVOURITE_RATE ? favours : randomInt(random, 0, lastZone);
  const guard = randomInt(random, 0, lastZone);

  const mine = strike(hero.stats, rival.stats, hit, guard, random);
  // Each line of the log shows as its blow lands.
  const log = later(IMPACT_AT, [heroBlow(mine, pick(random, HERO.moves), name, hit)]);
  const struck: Bout = {
    ...bout,
    rival: { ...rival, health: Math.max(0, rival.health - mine.damage) },
  };
  const won = struck.rival.health === 0;
  const first = swing('hero', mine, bout, struck, won);
  if (won) {
    const show: Show = { scenes: first, poses: { rival: KNOCKED_OUT } };
    return bout.stage === RIVALS.length - 1
      ? offer(struck, log, show)
      : interval(struck, log, show);
  }

  const theirs = strike(rival.stats, hero.stats, aim, block, random);
  log.push(...later(SWING_MS + IMPACT_AT, [rivalBlow(theirs, pick(random, moves), name, aim)]));
  const answered: Bout = {
    ...struck,
    hero: { ...hero, health: Math.max(0, hero.health - theirs.damage) },
  };
  const lost = answered.hero.health === 0;
  const scenes = [...first, ...swing('rival', theirs, struck, answered, lost)];
  if (lost) return rejection(answered, log, { scenes, poses: { hero: KNOCKED_OUT } });

  return {
    lines: [...ring(answered, log, { scenes }), blank(), ...controls()],
    next: round(answered),
  };
};

const toZone = (word: string): Zone | undefined => {
  const named = (ZONES as readonly string[]).indexOf(word);
  const zone = named >= 0 ? named : Number(word) - 1;
  return ZONES[zone] === undefined ? undefined : zone;
};

/**
 * Reads the player's move into the choice made so far. `hit 2` and `block 4`
 * set one half; bare zones fill the hit first, then the block, and two at
 * once (`2 4` or `24`) set both.
 */
export const choose = (choice: Choice, text: string): Choice | undefined => {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const [first = '', second = ''] = words;

  if (first === 'hit' || first === 'block') {
    const zone = toZone(second);
    return words.length === 2 && zone !== undefined ? { ...choice, [first]: zone } : undefined;
  }

  const bare = words.length === 1 && /^[1-5]{2}$/.test(first) ? [...first] : words;
  const [hit, block] = bare.map(toZone);
  if (hit === undefined || bare.length > 2) return undefined;
  if (bare.length === 2) return block === undefined ? undefined : { hit, block };
  return choice.hit === undefined ? { ...choice, hit } : { ...choice, block: hit };
};

const round = (bout: Bout, choice: Choice = {}): Session => ({
  prompt: choice.hit === undefined ? 'hit 1-5>' : 'block 1-5>',
  input: (text): SessionStep => {
    const chosen = choose(choice, text);
    if (!chosen) {
      return {
        lines: [
          line(dim('Zones are 1-5: `2 4` hits the chest and covers belt+legs. Or click them.')),
        ],
        next: round(bout, choice),
      };
    }

    const { hit, block } = chosen;
    if (hit !== undefined && block !== undefined) return exchange(bout, hit, block);

    const half =
      hit !== undefined
        ? line(dim('Aiming at the '), bright(zoneName(hit)), dim('. Now cover two zones.'))
        : line(dim('Covering '), bright(blockName(block ?? 0)), dim('. Now pick where to hit.'));
    return { lines: [half], next: round(bout, chosen) };
  },
});

const STAT_COLUMN = 10;

const characterSheet = (): Line[] => [
  line(dim('YOUR FIGHTER, straight from the résumé:')),
  ...HERO_STAT_SOURCES.map(({ stat, value, source }): Line => ({
    spans: [bright(`  ${STAT_LABELS[stat]} ${value}`.padEnd(STAT_COLUMN)), { text: source }],
    hang: STAT_COLUMN,
  })),
  line(dim('IN THE BAG:')),
  ...STARTING_ITEMS.map(itemRow),
];

export const fight: Command = {
  name: 'fight',
  summary: 'Beat the other candidates to the job offer',
  run: (_args, { random }) => {
    const stats = heroWith(STARTING_ITEMS);
    const hero: Combatant = { fighter: HERO, stats, health: maxHealth(stats) };
    const first = fresh(0, hero, STARTING_ITEMS, random);

    return {
      lines: [
        heading('fight club'),
        blank(),
        line(
          `One vacancy, ${RIVALS.length} other candidates. `,
          'HR will hire whoever is still standing.',
        ),
        blank(),
        ...characterSheet(),
        blank(),
        line(
          'Every exchange, pick where to hit and which two zones to cover: ',
          'click them, or type both numbers, e.g. `2 4`.',
        ),
        quitHint(),
        blank(),
        line(action('next', 'Enter the ring >')),
      ],
      session: {
        prompt: 'press Enter>',
        input: () => entrance(first),
      },
    };
  },
};
