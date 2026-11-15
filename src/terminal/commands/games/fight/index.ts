/**
 * `fight`: a turn-based brawl for a job offer, after the browser fight clubs
 * of the 2000s. The hero's stats come from the résumé; the opponents are the
 * other candidates. Rules live in `combat`, the cast in `roster`, the picture
 * in `arena`; this file runs the evening.
 */
import { profile } from '../../../../content/resume';
import { action, blank, bright, bullet, dim, heading, line } from '../../../line';
import type { Line, Span } from '../../../line';
import type { Command, Session, SessionStep } from '../../types';
import { pick, playAgain, quitHint, randomInt } from '../shared';
import { arena } from './arena';
import type { Combatant } from './arena';
import { STAT_LABELS, ZONES, blockName, maxHealth, strike, withBonuses, zoneName } from './combat';
import type { Blow, Stats, Zone } from './combat';
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

/** The ring on a clean screen, what just happened under it. */
const ring = ({ stage, hero, rival }: Bout, log: readonly Line[]): Line[] => {
  const [top, ...rest] = arena(hero, rival, `CANDIDATE ${stage + 1}/${RIVALS.length}`);
  return [...(top ? [{ ...top, clear: true }] : []), ...rest, ...log];
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

const offer = (bout: Bout, log: readonly Line[]): SessionStep => ({
  lines: [
    ...ring(bout, log),
    line(bright(bout.rival.fighter.name), ` ${rivalAt(bout.stage).defeat}`),
    blank(),
    heading('offer'),
    line(`"Dear ${firstName}, the other candidates are no longer available. When can you start?"`),
    blank(),
    line(
      dim('The real one hits deadlines just as hard, and needs no rubber duck: '),
      action('contact'),
    ),
    playAgain('fight'),
  ],
});

const rejection = (bout: Bout, log: readonly Line[]): SessionStep => ({
  lines: [
    ...ring(bout, log),
    blank(),
    heading('rejected'),
    line(
      '"Thank you for your interest. We have decided to move forward with ',
      bright(bout.rival.fighter.name),
      '. We will keep your résumé on file."',
    ),
    blank(),
    playAgain('fight'),
  ],
});

/** Between bouts: the loot, a coffee, and a look at who is next. */
const interval = (bout: Bout, log: readonly Line[]): SessionStep => {
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
      ...ring(bout, log),
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
    ],
    next: {
      prompt: 'press Enter>',
      input: () => entrance(next),
    },
  };
};

/** A new rival steps in. */
const entrance = (bout: Bout): SessionStep => ({
  lines: [...ring(bout, [line(dim(rivalAt(bout.stage).tell))]), blank(), ...controls()],
  next: round(bout),
});

/** One exchange: the hero strikes first, the rival answers if still standing. */
const exchange = (bout: Bout, hit: Zone, block: Zone): SessionStep => {
  const { random, hero, rival } = bout;
  const { name, favours, moves } = rivalAt(bout.stage);
  const lastZone = ZONES.length - 1;
  const aim = random() < FAVOURITE_RATE ? favours : randomInt(random, 0, lastZone);
  const guard = randomInt(random, 0, lastZone);

  const mine = strike(hero.stats, rival.stats, hit, guard, random);
  const log = [heroBlow(mine, pick(random, HERO.moves), name, hit)];
  const struck: Bout = {
    ...bout,
    rival: { ...rival, health: Math.max(0, rival.health - mine.damage) },
  };
  if (struck.rival.health === 0) {
    return bout.stage === RIVALS.length - 1 ? offer(struck, log) : interval(struck, log);
  }

  const theirs = strike(rival.stats, hero.stats, aim, block, random);
  log.push(rivalBlow(theirs, pick(random, moves), name, aim));
  const answered: Bout = {
    ...struck,
    hero: { ...hero, health: Math.max(0, hero.health - theirs.damage) },
  };
  if (answered.hero.health === 0) return rejection(answered, log);

  return { lines: [...ring(answered, log), blank(), ...controls()], next: round(answered) };
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
