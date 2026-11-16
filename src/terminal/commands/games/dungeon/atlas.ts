/**
 * The map of the dungeon as a picture: drawn from what the visitor has walked
 * and seen, never from the whole plan. It is an SVG in a data URL whose alpha
 * is the brightness, like every picture on this screen, so no file is fetched
 * and the map is redrawn by a pure function at every step.
 */
import { CHEST, DOOR, FOUNTAIN, PLAN, STAIRS, WALL, keyOf, tileAt, towards } from './maze';
import type { Heading, Point } from './maze';

/** What the map is drawn from; a descent has all of it. */
export interface Survey {
  at: Point;
  facing: Heading;
  /** Cells walked, by key. */
  visited: readonly string[];
  /** Chests emptied and doors unlocked, by cell. */
  opened: readonly string[];
  /** Health left to the dwellers met, by cell. */
  foes: Readonly<Record<string, number>>;
}

/** One cell of the plan, in the units of the drawing. */
const CELL = 10;
/** Rows of cells in the whole plan: what a map of everything would be tall. */
export const PLAN_ROWS = PLAN.length;

/** A drawing of the map and how many rows of cells it shows. */
export interface Chart {
  svg: string;
  rows: number;
}

/** Brightness of each thing on the map, from 0 to 1. */
const INK = { wall: 0.9, walked: 0.3, seen: 0.12, thing: 1 } as const;

const HEADINGS: readonly Heading[] = [0, 1, 2, 3];
const AROUND = [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y })));

const box = (x: number, y: number, width: number, height: number, ink: number): string =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" opacity="${ink}"/>`;

/** The marks of what stands in a cell, drawn over its floor. */
const things = (survey: Survey, point: Point, walked: boolean): string[] => {
  const x = point.x * CELL;
  const y = point.y * CELL;
  const key = keyOf(point);
  const tile = tileAt(point);
  const emptied = survey.opened.includes(key);

  if (tile === DOOR && !emptied) {
    // A bar across the corridor, whichever way the corridor runs.
    const across = tileAt(towards(point, 1)) === WALL && tileAt(towards(point, 3)) === WALL;
    return [across ? box(x, y + 4, CELL, 2, INK.thing) : box(x + 4, y, 2, CELL, INK.thing)];
  }
  if (tile === STAIRS) return [2, 4.5, 7].map((step) => box(x + 2, y + step, 6, 1, INK.thing));
  if (!walked) return [];

  if (tile === CHEST && !emptied) return [box(x + 3, y + 3.5, 4, 3, INK.thing)];
  if (tile === FOUNTAIN) {
    return [
      `<circle cx="${x + 5}" cy="${y + 5}" r="2.2" fill="none" stroke="#fff" stroke-width="1.2"/>`,
    ];
  }
  // A dweller met and left alive: the visitor ran.
  if ((survey.foes[key] ?? 0) > 0) {
    return [`<path d="M${x + 5} ${y + 2}l3 3-3 3-3-3z" opacity="${INK.thing}"/>`];
  }
  return [];
};

/**
 * The map as SVG: walls bright, floor dim, and nothing of what was never seen.
 * It is cut to the part that is known, at one scale: it grows as the visitor walks.
 */
export const chart = (survey: Survey): Chart => {
  const walked = (point: Point): boolean => survey.visited.includes(keyOf(point));
  /** Floor walked, or seen from the cell next to it; never round a corner. */
  const known = (point: Point): boolean =>
    tileAt(point) !== WALL &&
    (walked(point) || HEADINGS.some((heading) => walked(towards(point, heading))));

  const cells = PLAN.flatMap((row, y) => [...row].map((tile, x) => ({ tile, point: { x, y } })));
  const drawn = cells.flatMap(({ tile, point }) => {
    const { x, y } = point;
    if (tile === WALL) {
      // A wall shows where it closes in floor that is known.
      const closing = AROUND.some((step) => known({ x: x + step.x, y: y + step.y }));
      return closing ? [{ point, shapes: [box(x * CELL, y * CELL, CELL, CELL, INK.wall)] }] : [];
    }
    if (!known(point)) return [];

    const floor = box(x * CELL, y * CELL, CELL, CELL, walked(point) ? INK.walked : INK.seen);
    return [{ point, shapes: [floor, ...things(survey, point, walked(point))] }];
  });
  const shapes = drawn.flatMap((cell) => cell.shapes);
  const across = drawn.map(({ point }) => point.x);
  const down = drawn.map(({ point }) => point.y);
  const left = Math.min(...across);
  const top = Math.min(...down);
  const columns = Math.max(...across) - left + 1;
  const rows = Math.max(...down) - top + 1;

  const { x, y } = survey.at;
  const arrow =
    `<path d="M${x * CELL + 5} ${y * CELL + 1.5}l3.2 7h-6.4z" shape-rendering="auto" ` +
    `transform="rotate(${survey.facing * 90} ${x * CELL + 5} ${y * CELL + 5})"/>`;

  const width = columns * CELL;
  const height = rows * CELL;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left * CELL} ${top * CELL} ${width} ${height}" ` +
    `width="${width * 4}" height="${height * 4}" fill="#fff" shape-rendering="crispEdges">` +
    `${shapes.join('')}${arrow}</svg>`;
  return { svg, rows };
};

/** A drawing as something a picture can point at. */
export const urlOf = ({ svg }: Chart): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;
