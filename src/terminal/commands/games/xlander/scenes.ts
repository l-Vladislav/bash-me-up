/**
 * The pictures of the flight, one for every stage of it and one for every way
 * it ends. They live in `src/assets/xlander`, made with
 * `scripts/picture.py --root xlander`; a scene whose file is missing fails the
 * build rather than showing a blank.
 */
import type { Picture } from '../../../line';

const SCENES = {
  staging: 'Hot staging above the curve of the Earth: the ship pulls away from the booster',
  boostback: 'The booster, turned around, firing its engines back the way it came',
  coast: 'The booster coasting engines first at the edge of space',
  fins: 'The booster plunging into the clouds, its grid fins spread',
  falling: 'Far below the falling booster, the launch tower by the sea',
  burn: 'The landing burn: a column of fire above the tower and its open arms',
  hover: 'The booster settling between the arms of the tower on three engines',
  caught: 'The booster held in mid-air by the two arms of the tower',
  explosion: 'A fireball at the foot of the launch tower',
  splashdown: 'The booster bursting into flame as it hits the sea',
  terminated: 'The booster blown apart high above the coast',
} as const;

export type Scene = keyof typeof SCENES;

const files = import.meta.glob<string>('../../../../assets/xlander/*.png', {
  eager: true,
  import: 'default',
});

const sources = Object.fromEntries(
  Object.keys(SCENES).map((scene) => {
    const src = files[`../../../../assets/xlander/${scene}.png`];
    if (!src) throw new Error(`xlander: no ${scene}.png in src/assets/xlander`);
    return [scene, src];
  }),
) as Record<Scene, string>;

/** Rows of text a scene is tall, at most; small screens shrink it. */
export const SCENE_ROWS = 13;

/** How a scene comes on: as it was, some way of its own, or drawn in line by line. */
export type Entrance = Pick<Picture, 'still' | 'motion' | 'after'>;

/** A scene, with the telemetry down its side where the screen is wide enough. */
export const sceneOf = (
  scene: Scene,
  entrance: Entrance = {},
  upcoming: readonly Scene[] = [],
): Picture => ({
  src: sources[scene],
  alt: SCENES[scene],
  rows: SCENE_ROWS,
  side: 'scene',
  ...entrance,
  upcoming: [...new Set(upcoming)].filter((next) => next !== scene).map((next) => sources[next]),
});
