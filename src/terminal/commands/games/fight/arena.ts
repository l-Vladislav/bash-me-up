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

/** Characters between a panel's borders. */
const INNER = 21;
const GAP = '    ';
const VERSUS = ' VS ';
const BAR = 8;

const fit = (text: string): string => text.slice(0, INNER).padEnd(INNER);

const centre = (text: string): string =>
  fit(' '.repeat(Math.max(0, Math.floor((INNER - text.length) / 2))) + text);

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
const panel = (title: string, combatant: Combatant): Span[][] => {
  const { fighter } = combatant;
  const row = (cell: Span): Span[] => [dim('| '), cell, dim(' |')];
  const plain = (text: string): Span => ({ text: fit(text) });

  return [
    [dim(`+- ${title} ${'-'.repeat(INNER - title.length - 1)}+`)],
    row(bright(fit(fighter.name.toUpperCase()))),
    row(dim(fit(fighter.tagline))),
    row(plain('')),
    ...fighter.figure.map((part) => row({ text: centre(part) })),
    row(plain('')),
    row(plain(healthRow(combatant))),
    row(dim(fit(statsRow(combatant)))),
    [dim(`+${'-'.repeat(INNER + 2)}+`)],
  ];
};

/** The row the "VS" sits on: the middle of the figures. */
const VERSUS_ROW = 5;

export const arena = (hero: Combatant, rival: Combatant, rivalTitle: string): Line[] => {
  const right = panel(rivalTitle, rival);
  return panel('YOU', hero).map((left, index) => ({
    spans: [
      ...left,
      index === VERSUS_ROW ? bright(VERSUS) : { text: GAP },
      ...(right[index] ?? []),
    ],
    art: true,
  }));
};
