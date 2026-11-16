/**
 * The pictures of the dungeon: one for every shape a corridor can take seen
 * from inside, and one for everything met in it. They live in
 * `src/assets/dungeon`, made with `scripts/picture.py --root dungeon`; a scene
 * whose file is missing fails the build rather than showing a blank.
 */
import type { Picture } from '../../../line';

const SCENES = {
  'dead-end': 'A dead end: a blank stone wall',
  ahead: 'A stone corridor running into the dark',
  left: 'A wall ahead and an archway on the left',
  right: 'A wall ahead and an archway on the right',
  'ahead-left': 'A corridor running on, with an archway on the left',
  'ahead-right': 'A corridor running on, with an archway on the right',
  'left-right': 'A wall ahead and an archway on either side',
  crossroads: 'A crossroads: the corridor runs on, with an archway on either side',
  door: 'A heavy wooden door at the end of the corridor',
  stairs: 'Stairs climbing towards daylight',
  chest: 'An iron-bound chest in an alcove',
  fountain: 'A fountain running into a stone basin',
  rat: 'A giant rat baring its teeth',
  spider: 'A giant spider hanging in its web',
  wraith: 'A hooded wraith reaching out',
  skeleton: 'A skeleton with a sword and a shield',
  minotaur: 'A minotaur with a two-headed axe',
  death: 'A skull and a dropped sword on the floor',
  escape: 'Sunrise over the hills, seen from the mouth of a cave',
} as const;

export type Scene = keyof typeof SCENES;

const files = import.meta.glob<string>('../../../../assets/dungeon/*.png', {
  eager: true,
  import: 'default',
});

const sources = Object.fromEntries(
  Object.keys(SCENES).map((scene) => {
    const src = files[`../../../../assets/dungeon/${scene}.png`];
    if (!src) throw new Error(`dungeon: no ${scene}.png in src/assets/dungeon`);
    return [scene, src];
  }),
) as Record<Scene, string>;

/** Rows of text a scene is tall, at most; small screens shrink it. */
export const SCENE_ROWS = 13;

/** How a scene comes on: as it was, some way of its own, or drawn in line by line. */
export type Entrance = Pick<Picture, 'still' | 'motion' | 'after'>;

/**
 * A scene: on a wide screen the hero and the story run down its right side,
 * so the whole of it fits a laptop; on a narrow one they follow below.
 * `upcoming` are the scenes one move away, fetched while this one is looked at.
 */
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
