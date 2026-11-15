/**
 * Who fights: the hero, built from the résumé in `content/portfolio.json`,
 * and the other candidates for the same job.
 */
import { experience, profile, skills } from '../../../../content/resume';
import type { Stats, Zone } from './combat';

export interface Item {
  name: string;
  note: string;
  bonus: Partial<Stats>;
}

export interface Fighter {
  name: string;
  /** One line under the name; the panel shows 21 characters. */
  tagline: string;
  /** Three rows of equal width. */
  figure: readonly [string, string, string];
  stats: Stats;
  /** What the fighter hits with, worded to follow "lands ..." or "your ...". */
  moves: readonly string[];
}

export interface Rival extends Fighter {
  /** The zone this candidate aims at half of the time. */
  favours: Zone;
  /** The same, as a hint to the player. */
  tell: string;
  /** Follows the name once the candidate is down. */
  defeat: string;
  /** What the winner takes home. */
  loot?: Item;
}

const skillCount = (...groups: string[]): number =>
  skills
    .filter(({ name }) => groups.includes(name))
    .reduce((total, { items }) => total + items.length, 0);

/** Where each of the hero's stats comes from; shown on the character sheet. */
export const HERO_STAT_SOURCES: readonly { stat: keyof Stats; value: number; source: string }[] = [
  {
    stat: 'strength',
    value: skillCount('Frontend', 'Backend'),
    source: 'frontend + backend skills: hits with the full stack',
  },
  {
    stat: 'agility',
    value: skillCount('Cloud', 'Leadership'),
    source: 'cloud + leadership skills: Agile, after all',
  },
  {
    stat: 'intuition',
    value: skillCount('AI', 'Quality'),
    source: 'AI + quality skills: smells the bug before the stand-up',
  },
  {
    stat: 'endurance',
    value: experience.reduce((total, { highlights }) => total + highlights.length, 0),
    source: 'one per résumé bullet point survived in production',
  },
];

const heroStat = (stat: keyof Stats): number =>
  HERO_STAT_SOURCES.find((entry) => entry.stat === stat)?.value ?? 0;

export const HERO: Fighter = {
  name: profile.name,
  tagline: 'Battle-tested in prod',
  figure: [' O  ', '/|\\#', '/ \\ '],
  stats: {
    strength: heroStat('strength'),
    agility: heroStat('agility'),
    intuition: heroStat('intuition'),
    endurance: heroStat('endurance'),
  },
  // Every skill on the résumé is a punch.
  moves: skills.flatMap(({ items }) => items),
};

/** What the hero walks in with. */
export const STARTING_ITEMS: readonly Item[] = [
  {
    name: 'Chunk of ColdFusion monolith',
    note: 'Legacy. Heavy. Nobody dares touch it.',
    bonus: { strength: 2 },
  },
  {
    name: 'Rubber duck',
    note: 'Knows where the bug is. Says nothing.',
    bonus: { intuition: 2 },
  },
  {
    name: 'Conference hoodie',
    note: 'Free, XL, absorbs criticism.',
    bonus: { endurance: 3 },
  },
];

/** The other candidates, in the order they are met. */
export const RIVALS: readonly Rival[] = [
  {
    name: 'Bootcamp Grad',
    tagline: '12 weeks of React',
    figure: ['[]o ', ' \\|\\', ' / \\'],
    stats: { strength: 7, agility: 5, intuition: 4, endurance: 4 },
    moves: [
      'a todo app',
      'a Udemy certificate',
      'console.log',
      'a 12-week curriculum',
      'a copied Stack Overflow answer',
    ],
    favours: 4,
    tell: 'Watched one tutorial, and it was about kicks: mostly goes for the legs.',
    defeat: 'goes back to finish the tutorial.',
    loot: {
      name: 'Certificate of completion',
      note: 'Laminated. Stops small-calibre feedback.',
      bonus: { endurance: 2 },
    },
  },
  {
    name: 'LinkedIn Influencer',
    tagline: 'Humbled to announce',
    figure: ['[]\\O ', '   |\\', '  / \\'],
    stats: { strength: 9, agility: 10, intuition: 6, endurance: 5 },
    moves: [
      'a humble brag',
      'a carousel post',
      'a thought-leadership thread',
      'an "Agree?" poll',
      'an open-to-work banner',
    ],
    favours: 1,
    tell: 'Speaks from the heart and hits there too: favours the chest.',
    defeat: 'is already drafting "What getting knocked out taught me about B2B sales".',
    loot: {
      name: 'Ring light',
      note: 'Blinds whoever stands in front of it.',
      bonus: { agility: 2 },
    },
  },
  {
    name: 'LeetCode Grinder',
    tagline: '2,000 problems solved',
    figure: ['|~~| O ', '|~~|/|\\', '    / \\'],
    stats: { strength: 11, agility: 7, intuition: 13, endurance: 6 },
    moves: [
      'an inverted binary tree',
      'a two-pointer technique',
      'dynamic programming',
      'a linked-list reversal',
      'an O(n log n) solution',
    ],
    favours: 2,
    tell: 'Trusts the gut and punches it: favours the belly.',
    defeat: 'passes out mumbling "but it was O(1) space".',
    loot: {
      name: 'Whiteboard marker',
      note: 'Dried out years ago. Still stings.',
      bonus: { strength: 2 },
    },
  },
  {
    name: 'AI Agent',
    tagline: '$20 a month, no sleep',
    figure: ['[o_o]', '/[_]\\', ' d b '],
    stats: { strength: 13, agility: 11, intuition: 9, endurance: 8 },
    moves: [
      'a hallucinated API',
      'a confident wrong answer',
      '"You are absolutely right!"',
      '4,000 tokens of apology',
      'a regenerated response',
    ],
    favours: 3,
    tell: 'Statistically the most likely next token is the belt.',
    defeat: 'apologises for the confusion and shuts down.',
    loot: {
      name: 'Slightly used GPU',
      note: 'Still warm. Predicts the next punch.',
      bonus: { intuition: 2 },
    },
  },
  {
    name: "The CEO's Nephew",
    tagline: 'Already has the badge',
    figure: ['\\  O  ', ' \\/|\\ ', '  / \\ '],
    stats: { strength: 15, agility: 8, intuition: 11, endurance: 11 },
    moves: [
      'a call to his uncle',
      'a golf club',
      'the family name',
      'a pre-signed offer letter',
      'a reserved parking spot',
    ],
    favours: 0,
    tell: 'Was promised Head of Something, so he goes for the head.',
    defeat: 'calls his uncle. The uncle does not pick up.',
  },
];
