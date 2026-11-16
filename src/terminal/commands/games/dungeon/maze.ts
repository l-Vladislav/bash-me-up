/** The dungeon's floor plan and the geometry of walking it. Pure. */

/**
 * One character a cell: `#` rock, `.` floor, `@` the way in, `<` the stairs
 * out, `D` the locked door, `c` a chest, `f` the fountain, and the dwellers:
 * `r`at, `s`pider, `w`raith, s`k`eleton, `M`inotaur.
 *
 * Chests and the fountain stand in dead ends, and the door and the stairs
 * close a straight corridor: the pictures of them show no side passages.
 */
export const PLAN = [
  '###########',
  '#@.r....#c#',
  '#.###.#.#.#',
  '#.#c#.#.s.#',
  '#.#.#.#.###',
  '#...#f#...#',
  '#.#######k#',
  '#.w.c##<MD#',
  '###########',
] as const;

export interface Point {
  x: number;
  y: number;
}

/** North, east, south, west. */
export type Heading = 0 | 1 | 2 | 3;

export type Turn = 'left' | 'right' | 'back';

export type Foe = 'rat' | 'spider' | 'wraith' | 'skeleton' | 'minotaur';

const STEPS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const QUARTERS: Readonly<Record<Turn, number>> = { right: 1, back: 2, left: 3 };

const DWELLERS: Readonly<Record<string, Foe>> = {
  r: 'rat',
  s: 'spider',
  w: 'wraith',
  k: 'skeleton',
  M: 'minotaur',
};

export const WALL = '#';
export const DOOR = 'D';
export const STAIRS = '<';
export const CHEST = 'c';
export const FOUNTAIN = 'f';

/** Names a cell, for the records of what was met, opened and seen there. */
export const keyOf = ({ x, y }: Point): string => `${x},${y}`;

/** What the plan holds at a point; rock beyond its edges. */
export const tileAt = ({ x, y }: Point): string => PLAN[y]?.[x] ?? WALL;

export const foeAt = (point: Point): Foe | undefined => DWELLERS[tileAt(point)];

export const turned = (heading: Heading, turn: Turn): Heading =>
  ((heading + QUARTERS[turn]) % 4) as Heading;

/** The next cell in a direction. */
export const towards = ({ x, y }: Point, heading: Heading): Point => {
  const step = STEPS[heading] ?? { x: 0, y: 0 };
  return { x: x + step.x, y: y + step.y };
};

/** The way from a cell to the one next to it. */
export const headingTo = (from: Point, to: Point): Heading => {
  const heading = STEPS.findIndex(({ x, y }) => from.x + x === to.x && from.y + y === to.y);
  return (heading < 0 ? 0 : heading) as Heading;
};

/** Where the visitor comes in, looking down the first corridor. */
export const ENTRANCE: Point = (() => {
  const y = PLAN.findIndex((row) => row.includes('@'));
  return { x: PLAN[y]?.indexOf('@') ?? 0, y };
})();

export const ENTRANCE_HEADING: Heading = 1;
