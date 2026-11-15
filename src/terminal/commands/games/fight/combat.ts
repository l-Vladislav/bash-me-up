/**
 * The rules of the fight, after the browser fight clubs of the 2000s: every
 * exchange each side picks a zone to hit and two neighbouring zones to cover.
 * Pure arithmetic: the dice come in from outside.
 */
import { randomInt } from '../shared';

export const ZONES = ['head', 'chest', 'belly', 'belt', 'legs'] as const;

/** Index into `ZONES`. */
export type Zone = number;

export interface Stats {
  /** Damage of a blow. */
  strength: number;
  /** Chance to dodge, measured against the attacker's agility. */
  agility: number;
  /** Chance of a critical hit, measured against the defender's intuition. */
  intuition: number;
  /** Health. */
  endurance: number;
}

export const STAT_LABELS: Readonly<Record<keyof Stats, string>> = {
  strength: 'STR',
  agility: 'AGI',
  intuition: 'INT',
  endurance: 'END',
};

const BASE_HEALTH = 30;
const HEALTH_PER_ENDURANCE = 3;

/** Chances in percent: the base, the gain per point of advantage, and the limits. */
const DODGE = { base: 10, perPoint: 3, min: 5, max: 35 };
const CRITICAL = { base: 10, perPoint: 3, min: 5, max: 40 };
const CRITICAL_MULTIPLIER = 2;

export const maxHealth = ({ endurance }: Stats): number =>
  BASE_HEALTH + endurance * HEALTH_PER_ENDURANCE;

/** A block covers the chosen zone and the one below it; legs wrap around to the head. */
export const blockedZones = (block: Zone): [Zone, Zone] => [block, (block + 1) % ZONES.length];

export const zoneName = (zone: Zone): string => ZONES[zone] ?? '?';

/** What a block covers, e.g. `legs+head`. */
export const blockName = (block: Zone): string => blockedZones(block).map(zoneName).join('+');

const chance = (odds: typeof DODGE, advantage: number): number =>
  Math.min(odds.max, Math.max(odds.min, odds.base + odds.perPoint * advantage)) / 100;

export type BlowKind = 'dodged' | 'blocked' | 'hit' | 'critical' | 'pierced';

export interface Blow {
  kind: BlowKind;
  damage: number;
}

/**
 * One blow at `zone` against a defender covering `block`. A block stops
 * everything but a critical hit, which goes through it at plain damage.
 */
export const strike = (
  attacker: Stats,
  defender: Stats,
  zone: Zone,
  block: Zone,
  random: () => number,
): Blow => {
  if (random() < chance(DODGE, defender.agility - attacker.agility)) {
    return { kind: 'dodged', damage: 0 };
  }

  const critical = random() < chance(CRITICAL, attacker.intuition - defender.intuition);
  const blocked = blockedZones(block).includes(zone);
  if (blocked && !critical) return { kind: 'blocked', damage: 0 };

  const damage = attacker.strength + randomInt(random, 0, Math.floor(attacker.strength / 2));
  if (blocked) return { kind: 'pierced', damage };
  return critical
    ? { kind: 'critical', damage: damage * CRITICAL_MULTIPLIER }
    : { kind: 'hit', damage };
};

/** Stats with the bonuses of everything carried added on. */
export const withBonuses = (stats: Stats, bonuses: readonly Partial<Stats>[]): Stats =>
  bonuses.reduce<Stats>(
    (total, bonus) => ({
      strength: total.strength + (bonus.strength ?? 0),
      agility: total.agility + (bonus.agility ?? 0),
      intuition: total.intuition + (bonus.intuition ?? 0),
      endurance: total.endurance + (bonus.endurance ?? 0),
    }),
    stats,
  );
