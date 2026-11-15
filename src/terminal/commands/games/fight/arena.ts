/**
 * The picture of the fight: two panels side by side, the hero on the left and
 * the other candidate on the right. As wide as the boot banner, so it shrinks
 * to fit a phone the same way.
 */
import { bright, dim } from '../../../line';
import type { Line, Span } from '../../../line';
import { STAT_LABELS, maxHealth } from './combat';
import type { Stats } from './combat';
import type { Fighter } from './roster';

export interface Combatant {
  fighter: Fighter;
  /** The fighter's stats with everything carried counted in. */
  stats: Stats;
  health: number;
}

/** How a fighter is drawn at one moment of the animation. */
export interface Pose {
  /** Columns the figure has moved from the middle of its panel; positive is to the right. */
  shift?: number;
  /** Shouted over the figure's head: `-15`, `BLOCK`, `K.O.` */
  note?: string;
  /** Knocked out, lying on the floor. */
  down?: boolean;
}

export interface Poses {
  hero?: Pose;
  rival?: Pose;
}

/** Characters between a panel's borders. */
const INNER = 21;
const GAP = '    ';
const VERSUS = ' VS ';
const BAR = 8;

/** Knocked out, feet towards the middle of the ring. */
const DOWN = {
  hero: ['      ', '      ', 'o-|--<'],
  rival: ['      ', '      ', '>--|-o'],
} as const;

const fit = (text: string): string => text.slice(0, INNER).padEnd(INNER);

const centre = (text: string, shift = 0): string => {
  const room = Math.max(0, INNER - text.length);
  const left = Math.min(room, Math.max(0, Math.floor(room / 2) + shift));
  return fit(' '.repeat(left) + text);
};

const healthRow = ({ stats, health }: Combatant): string => {
  const full = maxHealth(stats);
  const filled = Math.ceil((health / full) * BAR);
  return `HP [${'#'.repeat(filled)}${'.'.repeat(BAR - filled)}] ${health}/${full}`;
};

const statsRow = ({ stats }: Combatant): string =>
  (['strength', 'agility', 'intuition'] as const)
    .map((stat) => `${STAT_LABELS[stat]} ${stats[stat]}`)
    .join(' ');

/** One panel as rows of spans, every row `INNER + 4` characters wide. */
const panel = (
  side: keyof Poses,
  title: string,
  combatant: Combatant,
  { shift = 0, note = '', down = false }: Pose = {},
): Span[][] => {
  const { fighter } = combatant;
  const row = (cell: Span): Span[] => [dim('| '), cell, dim(' |')];
  const plain = (text: string): Span => ({ text: fit(text) });
  const figure = down ? DOWN[side] : fighter.figure;

  return [
    [dim(`+- ${title} ${'-'.repeat(INNER - title.length - 1)}+`)],
    row(bright(fit(fighter.name.toUpperCase()))),
    row(dim(fit(fighter.tagline))),
    row(bright(centre(note, shift))),
    ...figure.map((part) => row({ text: centre(part, shift) })),
    row(plain('')),
    row(plain(healthRow(combatant))),
    row(dim(fit(statsRow(combatant)))),
    [dim(`+${'-'.repeat(INNER + 2)}+`)],
  ];
};

/** The row the "VS" sits on: the middle of the figures. */
const VERSUS_ROW = 5;

export const arena = (
  hero: Combatant,
  rival: Combatant,
  rivalTitle: string,
  poses: Poses = {},
): Line[] => {
  const right = panel('rival', rivalTitle, rival, poses.rival);
  return panel('hero', 'YOU', hero, poses.hero).map((left, index) => ({
    spans: [
      ...left,
      index === VERSUS_ROW ? bright(VERSUS) : { text: GAP },
      ...(right[index] ?? []),
    ],
    art: true,
  }));
};
