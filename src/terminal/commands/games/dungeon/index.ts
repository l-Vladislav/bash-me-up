import portrait from '../../../../assets/gallery/portraits/portrait.png';
import { profile } from '../../../../content/resume';
import { action, blank, bright, dim, heading, later, line } from '../../../line';
import type { Line, Motion, Picture } from '../../../line';
import type { Command, Session, SessionStep } from '../../types';
import { playAgain, quitHint, randomInt } from '../shared';
import {
  CHEST,
  DOOR,
  ENTRANCE,
  ENTRANCE_HEADING,
  FOUNTAIN,
  STAIRS,
  WALL,
  foeAt,
  headingTo,
  keyOf,
  tileAt,
  towards,
  turned,
} from './maze';
import type { Foe, Heading, Point, Turn } from './maze';
import { PLAN_ROWS, chart, urlOf } from './atlas';
import { SCENE_ROWS, sceneOf } from './scenes';
import type { Entrance, Scene } from './scenes';

export const MAX_HEALTH = 20;
/** Health a potion gives back. */
const POTION = 10;
/** Damage of the dagger the visitor comes with; the sword adds to both ends. */
const DAGGER = [2, 4] as const;
const SWORD_BONUS = 2;
/** How often a dweller's blow lands, face to face and at a visitor backing away. */
const ACCURACY = 0.75;
const PARTING_ACCURACY = 0.5;
/** The dweller answers a blow this much later, in milliseconds. */
const REPLY_MS = 450;
/** One notch of a bar running down, or up, in milliseconds. */
const TICK_MS = 70;

interface Breed {
  name: string;
  health: number;
  /** Least and most damage of one blow. */
  damage: readonly [number, number];
  gold: number;
  enters: string;
  strikes: string;
  falls: string;
}

export const BREEDS: Readonly<Record<Foe, Breed>> = {
  rat: {
    name: 'giant rat',
    health: 6,
    damage: [1, 2],
    gold: 2,
    enters: 'A giant rat blocks the way, all teeth.',
    strikes: 'bites',
    falls: 'The rat squeals and lies still.',
  },
  spider: {
    name: 'giant spider',
    health: 9,
    damage: [1, 3],
    gold: 5,
    enters: 'A giant spider drops from its web.',
    strikes: 'stings',
    falls: 'The spider curls up on its back.',
  },
  wraith: {
    name: 'wraith',
    health: 10,
    damage: [2, 3],
    gold: 8,
    enters: 'The air turns cold. A wraith drifts out of the wall.',
    strikes: 'claws',
    falls: 'The wraith comes apart like smoke.',
  },
  skeleton: {
    name: 'skeleton',
    health: 12,
    damage: [2, 4],
    gold: 10,
    enters: 'A skeleton steps out of the dark, sword up.',
    strikes: 'slashes',
    falls: 'The skeleton drops into a heap of bones.',
  },
  minotaur: {
    name: 'minotaur',
    health: 22,
    damage: [3, 5],
    gold: 30,
    enters: 'The minotaur was waiting. It lowers its horns.',
    strikes: 'cleaves',
    falls: 'The minotaur crashes down, and the floor shakes.',
  },
};

interface Loot {
  gold: number;
  potions?: number;
  sword?: boolean;
  key?: boolean;
}

/** What each chest of the plan holds, by cell. */
export const CHESTS: Readonly<Record<string, Loot>> = {
  '3,3': { gold: 5, potions: 1 },
  '9,1': { gold: 10, sword: true },
  '4,7': { gold: 15, potions: 1, key: true },
};

/** One descent, as it stands. */
interface Delve {
  at: Point;
  facing: Heading;
  /** The cell the visitor came from: the way to run. */
  from: Point;
  health: number;
  potions: number;
  gold: number;
  sword: boolean;
  key: boolean;
  /** Health left to the dwellers met so far, by cell; none is dead. */
  foes: Readonly<Record<string, number>>;
  /** Chests emptied and doors unlocked, by cell. */
  opened: readonly string[];
  /** Cells walked, for the map. */
  visited: readonly string[];
  steps: number;
  /** What is on the screen, which is not drawn in a second time. */
  showing?: Scene | 'map';
  random: () => number;
}

const isOpened = ({ opened }: Delve, point: Point): boolean => opened.includes(keyOf(point));

const passable = (delve: Delve, point: Point): boolean => {
  const tile = tileAt(point);
  return tile !== WALL && (tile !== DOOR || isOpened(delve, point));
};

const foeHealth = ({ foes }: Delve, point: Point, foe: Foe): number =>
  foes[keyOf(point)] ?? BREEDS[foe].health;

/** The dweller alive in a cell, if any. */
const lurking = (delve: Delve, point: Point): Foe | undefined => {
  const foe = foeAt(point);
  return foe !== undefined && foeHealth(delve, point, foe) > 0 ? foe : undefined;
};

/** Corridor shapes by what is open: left, ahead, right. */
const SHAPES: Readonly<Record<string, Scene>> = {
  '000': 'dead-end',
  '010': 'ahead',
  '100': 'left',
  '001': 'right',
  '110': 'ahead-left',
  '011': 'ahead-right',
  '101': 'left-right',
  '111': 'crossroads',
};

const WAYS = ['left', 'ahead', 'right'] as const;

/** Which of left, ahead and right can be walked. */
const openings = (delve: Delve): readonly boolean[] => {
  const { at, facing } = delve;
  return [turned(facing, 'left'), facing, turned(facing, 'right')].map((heading) =>
    passable(delve, towards(at, heading)),
  );
};

/** What the visitor sees: a dweller in the way, a thing in front, or bare corridor. */
export const view = (delve: Delve): Scene => {
  const foe = lurking(delve, delve.at);
  if (foe) return foe;

  const [left = false, ahead = false, right = false] = openings(delve);
  if (!left && !right) {
    const beyond = tileAt(towards(delve.at, delve.facing));
    if (beyond === DOOR && !ahead) return 'door';
    if (beyond === STAIRS) return 'stairs';
    if (!ahead && tileAt(delve.at) === CHEST) return 'chest';
    if (!ahead && tileAt(delve.at) === FOUNTAIN) return 'fountain';
  }
  return SHAPES[[left, ahead, right].map(Number).join('')] ?? 'dead-end';
};

const listed = (items: readonly string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const describe = (delve: Delve, scene: Scene): string => {
  switch (scene) {
    case 'door':
      return delve.key
        ? 'A heavy door bars the way. The key in your pocket looks about right.'
        : 'A heavy door bars the way. It is locked.';
    case 'stairs':
      return 'Stairs, and daylight at the top of them.';
    case 'chest':
      return isOpened(delve, delve.at)
        ? 'The chest stands open and empty.'
        : 'A chest, and nobody guarding it.';
    case 'fountain':
      return 'Cold, clear water runs into a stone basin.';
    default: {
      const open = openings(delve);
      const ways = WAYS.filter((_, index) => open[index]);
      const shape =
        ways.length === 0 ? 'A dead end. The only way is back.' : `The way leads ${listed(ways)}.`;
      const stirring = open[1] && lurking(delve, towards(delve.at, delve.facing));
      return stirring ? `${shape} Something moves in the dark ahead.` : shape;
    }
  }
};

/** Short enough for the hero's rows to fit beside the portrait on a phone. */
const BAR = 10;

const bar = (health: number, full: number): string => {
  const filled = Math.ceil((health / full) * BAR);
  return `[${'#'.repeat(filled)}${'.'.repeat(BAR - filled)}] ${health}/${full}`;
};

const reach = ({ sword }: Delve): readonly [number, number] => {
  const bonus = sword ? SWORD_BONUS : 0;
  return [DAGGER[0] + bonus, DAGGER[1] + bonus];
};

const LABEL = 8;

const gauge = (label: string, ...value: Parameters<typeof line>): Line =>
  line(dim(label.padEnd(LABEL)), ...value);

/** A row with a number in it, counting from what it was to what it is, after `wait` ms. */
const counting = (from: number, to: number, wait: number, row: (value: number) => Line): Line => {
  const settled = row(to);
  if (from === to) return settled;

  const step = Math.sign(to - from);
  const frames = Array.from({ length: Math.abs(to - from) }, (_, index) => ({
    spans: row(from + index * step).spans,
    ms: index === 0 ? wait + TICK_MS : TICK_MS,
  }));
  return { ...settled, frames };
};

/** As tall as the portrait, which stands left of these rows. */
const sheet = (delve: Delve, before: Delve, wait: number): Line[] => {
  const [least, most] = reach(delve);
  return [
    line(bright(profile.name.toUpperCase())),
    counting(before.health, delve.health, wait, (health) => gauge('HP', bar(health, MAX_HEALTH))),
    gauge('WEAPON', delve.sword ? 'sword' : 'dagger', dim(` ${least}-${most}`)),
    gauge('POTIONS', String(delve.potions)),
    counting(before.gold, delve.gold, 0, (gold) =>
      gauge('GOLD', String(gold), delve.key ? dim('   KEY ') : '', delve.key ? 'iron' : ''),
    ),
  ];
};

/** The portrait, which flinches at a blow, and the hero's numbers beside it. */
const hero = (delve: Delve, before: Delve = delve, wait = 0): { face: Line; rows: Line[] } => {
  const rows = sheet(delve, before, wait);
  const entrance: Entrance =
    delve.health < before.health
      ? { motion: 'shake', after: wait }
      : // Drawn in once, when the torch is lit.
        { still: delve.showing !== undefined };
  const image: Picture = {
    src: portrait,
    alt: `Portrait of ${profile.name}`,
    rows: rows.length,
    side: 'left',
    ...entrance,
  };
  return { face: { spans: [], image }, rows };
};

const MAP_ALT = 'Map of the dungeon walked so far';
/** Rows of text a map of the whole dungeon would be tall in the corner. */
const CORNER_ROWS = 6;

/** The map so far, at a scale where all of the dungeon would be `full` rows tall. */
const mapOf = (delve: Delve, full: number): Pick<Picture, 'src' | 'alt' | 'rows'> => {
  const drawing = chart(delve);
  return { src: urlOf(drawing), alt: MAP_ALT, rows: (full * drawing.rows) / PLAN_ROWS };
};

/** The map in the corner of a screen broad enough for it; elsewhere `map` shows it. */
const corner = (delve: Delve): Line => ({
  spans: [],
  image: {
    ...mapOf(delve, CORNER_ROWS),
    side: 'right',
    still: delve.showing !== undefined,
  },
  screen: 'broad',
});

const foeRow = (delve: Delve, foe: Foe, before: Delve): Line => {
  const { name, health } = BREEDS[foe];
  return counting(foeHealth(before, delve.at, foe), foeHealth(delve, delve.at, foe), 0, (left) =>
    line(bright(name.toUpperCase()), ' ', bar(left, health)),
  );
};

const buttons = (commands: readonly string[]): Line =>
  line(
    ...commands.flatMap((command, index) =>
      index === 0 ? [action(command)] : ['  ', action(command)],
    ),
  );

const SIDES = ['left', 'right'] as const;

/** Whether a turn leaves the visitor looking down a passage, not at a wall. */
const leads = (delve: Delve, turn: Turn): boolean =>
  passable(delve, towards(delve.at, turned(delve.facing, turn)));

/** The moves that lead somewhere from here, as buttons. */
const controls = (delve: Delve, fighting: boolean): Line => {
  if (fighting) return buttons(['attack', ...(delve.potions > 0 ? ['drink'] : []), 'flee']);

  const here = tileAt(delve.at);
  const ahead = tileAt(towards(delve.at, delve.facing)) !== WALL;
  const chest = here === CHEST && !isOpened(delve, delve.at);
  const drink = here === FOUNTAIN || (delve.potions > 0 && delve.health < MAX_HEALTH);
  return buttons([
    ...(ahead ? ['forward'] : []),
    ...SIDES.filter((side) => leads(delve, side)),
    'back',
    ...(chest ? ['open'] : []),
    ...(drink ? ['drink'] : []),
    'map',
  ]);
};

const remembered = (keys: readonly string[], point: Point): readonly string[] =>
  keys.includes(keyOf(point)) ? keys : [...keys, keyOf(point)];

/** Where running from a fight leaves the visitor: a cell back, facing away. */
const retreat = (delve: Delve): Delve => ({
  ...delve,
  at: delve.from,
  from: delve.at,
  facing: headingTo(delve.at, delve.from),
  steps: delve.steps + 1,
});

/** The scenes one move away. */
const upcoming = (delve: Delve, foe: Foe | undefined): Scene[] => {
  if (foe) {
    const felled: Delve = { ...delve, foes: { ...delve.foes, [keyOf(delve.at)]: 0 } };
    return [view(felled), view(retreat(delve)), 'death'];
  }

  const ways: readonly Turn[] = [...SIDES.filter((side) => leads(delve, side)), 'back'];
  const turns = ways.map((way) => view({ ...delve, facing: turned(delve.facing, way) }));
  const target = towards(delve.at, delve.facing);
  const tile = tileAt(target);
  const locked = tile === DOOR && !isOpened(delve, target) && !delve.key;
  if (tile === WALL || locked) return turns;
  if (tile === STAIRS) return [...turns, 'escape'];
  return [...turns, view({ ...delve, at: target, opened: remembered(delve.opened, target) })];
};

/** How a screen is put on: what is told, and what moves. */
interface Staging {
  log?: readonly Line[];
  /** The descent a moment ago: the bars run from its numbers to the new ones. */
  before?: Delve;
  /** Milliseconds before a dweller's blow shows, on the bar, the portrait and the scene. */
  wait?: number;
  /** How the scene comes on, when not drawn in line by line. */
  motion?: Motion;
}

/** The whole screen anew: the scene, the hero beside it, what just happened. */
const show = (delve: Delve, staging: Staging = {}): SessionStep => {
  const { log = [], before = delve, wait = 0, motion } = staging;
  const scene = view(delve);
  const foe = lurking(delve, delve.at);
  const shown: Delve = { ...delve, showing: scene };
  const entrance: Entrance = motion ? { motion, after: wait } : { still: scene === delve.showing };
  const { face, rows } = hero(delve, before, wait);
  return {
    lines: [
      { spans: [], clear: true, image: sceneOf(scene, entrance, upcoming(delve, foe)) },
      face,
      corner(delve),
      ...rows,
      ...(foe ? [foeRow(delve, foe, before)] : []),
      ...log,
      ...(foe ? [] : [line(describe(delve, scene))]),
      blank(),
      controls(delve, foe !== undefined),
    ],
    next: foe ? combat(shown, foe) : explore(shown),
  };
};

/** The map in place of the scene, as large; any move brings the scene back. */
const survey = (delve: Delve): SessionStep => {
  const { face, rows } = hero(delve);
  const image: Picture = { ...mapOf(delve, SCENE_ROWS), side: 'scene' };
  return {
    lines: [
      { spans: [], clear: true, image },
      face,
      ...rows,
      line(
        dim('The arrow is you. A box is a chest, a ring the fountain, a bar a locked door, '),
        dim('stripes the stairs, a diamond something you ran from.'),
      ),
      blank(),
      controls(delve, false),
    ],
    next: explore({ ...delve, showing: 'map' }),
  };
};

/** A screen that ends the game: nothing on it but the picture and the story. */
const finale = (scene: Scene, story: readonly Line[]): SessionStep => ({
  lines: [
    { spans: [], clear: true, image: sceneOf(scene) },
    ...story,
    blank(),
    playAgain('dungeon'),
  ],
});

const tally = ({ gold, steps }: Delve): string => `${gold} gold, ${steps} steps`;

const TREASURE =
  Object.values(BREEDS).reduce((sum, { gold }) => sum + gold, 0) +
  Object.values(CHESTS).reduce((sum, { gold }) => sum + gold, 0);

const escape = (delve: Delve): SessionStep =>
  finale('escape', [
    line(bright('DAYLIGHT.'), ' You climb out of the dark and do not look back.'),
    line(
      dim(`${tally(delve)}. `),
      delve.gold === TREASURE
        ? 'Every last coin of it. The dungeon is yours.'
        : `Another ${TREASURE - delve.gold} gold is still down there.`,
    ),
  ]);

const death = (delve: Delve, foe: Foe, log: readonly Line[]): SessionStep =>
  finale('death', [
    ...log,
    line(bright('YOU DIED.'), ` The ${BREEDS[foe].name} keeps the torch.`),
    line(dim(`${tally(delve)}.`)),
  ]);

const hint = (delve: Delve, text: string): SessionStep => ({
  lines: [line(dim(text))],
  next: explore(delve),
});

const advance = (delve: Delve): SessionStep => {
  const target = towards(delve.at, delve.facing);
  const tile = tileAt(target);
  if (tile === WALL) return hint(delve, 'Solid rock that way.');

  const log: Line[] = [];
  let { opened } = delve;
  if (tile === DOOR && !isOpened(delve, target)) {
    if (!delve.key) return hint(delve, 'Locked. There must be a key somewhere down here.');
    opened = remembered(opened, target);
    log.push(line('The key turns, and the door groans open.'));
  }

  const moved: Delve = {
    ...delve,
    at: target,
    from: delve.at,
    opened,
    visited: remembered(delve.visited, target),
    steps: delve.steps + 1,
  };
  if (tile === STAIRS) return escape(moved);

  const foe = lurking(moved, target);
  if (foe) log.push(line(bright(BREEDS[foe].enters)));
  return show(moved, { log, motion: foe ? undefined : 'advance' });
};

const unpack = (delve: Delve): SessionStep => {
  if (tileAt(delve.at) !== CHEST || isOpened(delve, delve.at)) {
    return hint(delve, 'Nothing to open here.');
  }

  const loot = CHESTS[keyOf(delve.at)] ?? { gold: 1 };
  const finds = [
    `${loot.gold} gold`,
    ...(loot.potions ? ['a healing potion'] : []),
    ...(loot.sword ? ['a sword'] : []),
    ...(loot.key ? ['an iron key'] : []),
  ];
  return show(
    {
      ...delve,
      gold: delve.gold + loot.gold,
      potions: delve.potions + (loot.potions ?? 0),
      sword: delve.sword || Boolean(loot.sword),
      key: delve.key || Boolean(loot.key),
      opened: remembered(delve.opened, delve.at),
    },
    { log: [line('The lid creaks. Inside: ', bright(listed(finds)), '.')], before: delve },
  );
};

/** A potion down; undefined when there is none, or no need. */
const quaffed = (delve: Delve): Delve | undefined =>
  delve.potions > 0 && delve.health < MAX_HEALTH
    ? {
        ...delve,
        potions: delve.potions - 1,
        health: Math.min(MAX_HEALTH, delve.health + POTION),
      }
    : undefined;

const noDrink = (delve: Delve): string =>
  delve.potions > 0 ? 'Not a scratch on you. Save the potion.' : 'Nothing to drink.';

const drink = (delve: Delve): SessionStep => {
  if (tileAt(delve.at) === FOUNTAIN) {
    const words =
      delve.health < MAX_HEALTH
        ? 'You drink from the fountain, and the cuts close.'
        : 'You drink from the fountain. Nothing hurts, so nothing heals.';
    return show({ ...delve, health: MAX_HEALTH }, { log: [line(words)], before: delve });
  }
  const healed = quaffed(delve);
  return healed
    ? show(healed, { log: [line('The potion burns all the way down. It helps.')], before: delve })
    : hint(delve, noDrink(delve));
};

/** Round to face a passage; a wall is nothing to turn to, except to go back. */
const turn = (delve: Delve, way: Turn): SessionStep =>
  way === 'back' || leads(delve, way)
    ? show({ ...delve, facing: turned(delve.facing, way) }, { motion: way })
    : hint(delve, `No way to the ${way}: solid rock.`);

type Move = Turn | 'forward' | 'open' | 'drink' | 'map';

const MOVES: Readonly<Record<string, Move>> = {
  '': 'forward',
  forward: 'forward',
  f: 'forward',
  w: 'forward',
  left: 'left',
  l: 'left',
  a: 'left',
  right: 'right',
  r: 'right',
  d: 'right',
  back: 'back',
  b: 'back',
  s: 'back',
  open: 'open',
  o: 'open',
  drink: 'drink',
  potion: 'drink',
  map: 'map',
  m: 'map',
};

const explore = (delve: Delve): Session => ({
  prompt: 'dungeon>',
  input: (text): SessionStep => {
    const move = MOVES[text.trim().toLowerCase()];
    switch (move) {
      case 'forward':
        return advance(delve);
      case 'left':
      case 'right':
      case 'back':
        return turn(delve, move);
      case 'open':
        return unpack(delve);
      case 'drink':
        return drink(delve);
      case 'map':
        return survey(delve);
      default:
        return hint(delve, 'Try forward, left, right, back, open, drink or map. Or click them.');
    }
  },
});

/** A dweller's blow, which lands `accuracy` of the time. */
const blow = (delve: Delve, foe: Foe, accuracy: number): { after: Delve; row: Line } => {
  const { name, strikes, damage } = BREEDS[foe];
  if (delve.random() >= accuracy) return { after: delve, row: line(dim(`The ${name} misses.`)) };

  const hurt = randomInt(delve.random, damage[0], damage[1]);
  return {
    after: { ...delve, health: Math.max(0, delve.health - hurt) },
    row: line(`The ${name} ${strikes} you for `, bright(String(hurt)), '.'),
  };
};

/** The dweller's turn, a moment after whatever the visitor just did. */
const answer = (
  delve: Delve,
  foe: Foe,
  log: readonly Line[],
  before: Delve,
  motion: Motion,
): SessionStep => {
  const { after, row } = blow(delve, foe, ACCURACY);
  const told = [...log, ...later(REPLY_MS, [row])];
  return after.health === 0
    ? death(after, foe, told)
    : show(after, { log: told, before, wait: REPLY_MS, motion });
};

const attack = (delve: Delve, foe: Foe): SessionStep => {
  const { name, gold, falls } = BREEDS[foe];
  const [least, most] = reach(delve);
  const damage = randomInt(delve.random, least, most);
  const left = Math.max(0, foeHealth(delve, delve.at, foe) - damage);
  const hit = line(`You hit the ${name} for `, bright(String(damage)), '.');
  const struck: Delve = { ...delve, foes: { ...delve.foes, [keyOf(delve.at)]: left } };

  return left === 0
    ? show(
        { ...struck, gold: struck.gold + gold },
        { log: [hit, line(falls, dim(` +${gold} gold`))], before: delve },
      )
    : // The dweller flickers under the blow, then comes at the visitor.
      answer(struck, foe, [hit], delve, 'clash');
};

/** Back to the cell the visitor came from; the dweller gets a swing at the retreat. */
const flee = (delve: Delve, foe: Foe): SessionStep => {
  const { after, row } = blow(retreat(delve), foe, PARTING_ACCURACY);
  const told = [line('You back away, and run.'), row];
  return after.health === 0
    ? death(after, foe, told)
    : show(after, { log: told, before: delve, motion: 'back' });
};

type Action = 'attack' | 'drink' | 'flee';

const ACTIONS: Readonly<Record<string, Action>> = {
  '': 'attack',
  attack: 'attack',
  a: 'attack',
  hit: 'attack',
  drink: 'drink',
  d: 'drink',
  potion: 'drink',
  flee: 'flee',
  f: 'flee',
  run: 'flee',
  back: 'flee',
};

const combat = (delve: Delve, foe: Foe): Session => ({
  prompt: 'fight>',
  input: (text): SessionStep => {
    const stay = (words: string): SessionStep => ({
      lines: [line(dim(words))],
      next: combat(delve, foe),
    });

    switch (ACTIONS[text.trim().toLowerCase()]) {
      case 'attack':
        return attack(delve, foe);
      case 'flee':
        return flee(delve, foe);
      case 'drink': {
        const healed = quaffed(delve);
        return healed
          ? answer(healed, foe, [line('You gulp a potion down between blows.')], delve, 'lunge')
          : stay(noDrink(delve));
      }
      default:
        return stay(`The ${BREEDS[foe].name} is in your way: attack, drink or flee.`);
    }
  },
});

const descent = (random: () => number): Delve => ({
  at: ENTRANCE,
  facing: ENTRANCE_HEADING,
  from: ENTRANCE,
  health: MAX_HEALTH,
  potions: 1,
  gold: 0,
  sword: false,
  key: false,
  foes: {},
  opened: [],
  visited: [keyOf(ENTRANCE)],
  steps: 0,
  random,
});

export const dungeon: Command = {
  name: 'dungeon',
  summary: 'Find the way out, one picture at a time',
  run: (_args, { random }) => ({
    lines: [
      heading('dungeon'),
      blank(),
      line(
        'The trapdoor shuts above you. Somewhere down here are stairs back to daylight, ',
        'a locked door in front of them, and things that would rather you stayed.',
      ),
      blank(),
      line(
        'You see what is ahead of you: turn ',
        bright('left'),
        ', ',
        bright('right'),
        ' or ',
        bright('back'),
        ', step ',
        bright('forward'),
        ' (or just press Enter), and look at the ',
        bright('map'),
        ' when lost. Every word on the screen is a button, too.',
      ),
      quitHint(),
      blank(),
      line(action('next', 'Light the torch >')),
    ],
    session: {
      prompt: 'press Enter>',
      input: () => show(descent(random)),
    },
  }),
};
