/**
 * The flight of a Super Heavy booster home from hot staging, as SpaceX flies
 * it: a boostback burn turns its impact point from far out in the Gulf back to
 * the tower, the grid fins glide it closer on the way down, and the landing
 * burn brakes it on thirteen engines, then three, while it slides sideways
 * into the arms of the tower. Pure physics, no screens.
 */

/** Earth gravity, m/s². */
export const GRAVITY = 9.81;
/** Engines lit for the landing burn, at most: the inner thirteen. */
export const ENGINES = 13;
/** Engines that hold the booster in a hover: each one pushes a third of its weight. */
export const HOVER = 3;
/** Seconds of the landing burn per turn. */
export const TURN = 2;
/** Metres a turn on lit engines slides the booster sideways, towards the arms. */
export const DIVERT = 30;
/** Further off the arms than this, in metres, and the booster misses them. */
export const REACH = 5;

/** Kilometres of boostback burn a second takes off the impact point. */
export const BOOSTBACK_KM = 2.5;
export const MAX_BOOSTBACK = 60;
/** The flight director calls go for catch with the impact point this close, in km. */
export const GO_KM = 4;
/** Metres the grid fins can glide the booster in one turn. */
export const MAX_GLIDE = 1500;
/** Metres a gust can push the booster off, either way, while the fins steer. */
export const GUST = 150;

/** Where the landing burn begins: catch pins this high above the arms, falling this fast. */
export const BURN_START = { altitude: 3000, velocity: 300 } as const;
/** Propellant for the landing, in engine-seconds. */
export const FUEL = 240;

export interface Booster {
  /** Metres between the catch pins and the arms. */
  altitude: number;
  /** Metres per second; positive is falling. */
  velocity: number;
  /** Engine-seconds of propellant left. */
  fuel: number;
  /** Metres off the arms: positive east, out to sea; negative west, inland. */
  offset: number;
  /** Seconds since liftoff. */
  time: number;
}

export type Flight =
  | { caught: false; booster: Booster }
  | { caught: true; speed: number; offset: number; time: number };

/** One step of `distance` towards zero, stopping there. */
const closer = (value: number, distance: number): number =>
  Math.abs(value) <= distance ? 0 : value - Math.sign(value) * distance;

/** One turn of the landing burn on `requested` engines. */
export const fly = (booster: Booster, requested: number): Flight => {
  // Short of propellant, the engines run for part of the turn: the same as fewer for all of it.
  const engines = Math.min(requested, booster.fuel / TURN);
  const coasting = booster.fuel === 0;
  const acceleration = GRAVITY * (1 - engines / HOVER);
  const { altitude, velocity } = booster;
  const offset =
    engines > 0 ? closer(booster.offset, (DIVERT * engines) / requested) : booster.offset;

  // Time until the pins reach the arms: the root of altitude = drop(t), if within this turn.
  const discriminant = velocity * velocity + 2 * acceleration * altitude;
  const contact =
    discriminant < 0
      ? undefined
      : Math.abs(acceleration) < 1e-9
        ? altitude / velocity
        : (-velocity + Math.sqrt(discriminant)) / acceleration;

  if (contact !== undefined && contact > 0 && (coasting || contact <= TURN)) {
    return {
      caught: true,
      speed: velocity + acceleration * contact,
      offset,
      time: booster.time + contact,
    };
  }

  return {
    caught: false,
    booster: {
      altitude: altitude - (velocity * TURN + (acceleration * TURN * TURN) / 2),
      velocity: velocity + acceleration * TURN,
      fuel: Math.max(0, booster.fuel - engines * TURN),
      offset,
      time: booster.time + TURN,
    },
  };
};

/** The impact point after a boostback burn of `seconds`, in km east of the tower. */
export const boostback = (impact: number, seconds: number): number =>
  impact - seconds * BOOSTBACK_KM;

/**
 * The grid fins glide the booster up to `metres` towards the tower, past it
 * if asked to, and a gust of `gust` metres pushes it east or west.
 */
export const glide = (offset: number, metres: number, gust: number): number => {
  const towards = Math.min(metres, MAX_GLIDE) * -Math.sign(offset);
  return Math.round(offset + towards + gust);
};
