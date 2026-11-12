import { blank, bright, dim, line } from '../../line';
import type { Line } from '../../line';
import type { Command, Session, SessionStep } from '../types';
import { playAgain, quitHint } from './shared';

/** Lunar gravity, m/s². */
const GRAVITY = 1.62;
/** Deceleration per unit of burn rate, m/s². */
const THRUST = 0.3;
/** Seconds of flight per turn. */
const TURN = 5;
const MAX_BURN = 30;

export interface Craft {
  /** Metres above the surface. */
  altitude: number;
  /** Metres per second; positive is falling. */
  velocity: number;
  fuel: number;
  /** Seconds since the descent began. */
  time: number;
}

export const START: Craft = { altitude: 1000, velocity: 40, fuel: 120, time: 0 };

export type Flight =
  { landed: false; craft: Craft } | { landed: true; speed: number; time: number };

/** Advances the craft by one turn at the given burn rate. Pure physics. */
export const fly = (craft: Craft, requested: number): Flight => {
  const burn = Math.min(requested, craft.fuel);
  // Out of fuel, the craft falls until it hits the ground; otherwise one turn passes.
  const coasting = craft.fuel === 0;
  const acceleration = GRAVITY - burn * THRUST;
  const { altitude, velocity } = craft;

  const drop = (t: number): number => velocity * t + (acceleration * t * t) / 2;

  // Time until the surface: the root of altitude = drop(t), if it falls within this turn.
  const discriminant = velocity * velocity + 2 * acceleration * altitude;
  const impact =
    discriminant < 0
      ? undefined
      : Math.abs(acceleration) < 1e-9
        ? altitude / velocity
        : (-velocity + Math.sqrt(discriminant)) / acceleration;

  if (impact !== undefined && impact > 0 && (coasting || impact <= TURN)) {
    return { landed: true, speed: velocity + acceleration * impact, time: craft.time + impact };
  }

  return {
    landed: false,
    craft: {
      altitude: altitude - drop(TURN),
      velocity: velocity + acceleration * TURN,
      fuel: craft.fuel - burn,
      time: craft.time + TURN,
    },
  };
};

const COLUMNS = ['TIME', 'ALT m', 'VEL m/s', 'FUEL'] as const;
const WIDTH = 9;

const row = (cells: readonly string[]): Line => ({
  spans: [{ text: cells.map((cell) => cell.padStart(WIDTH)).join('') }],
  nowrap: true,
});

const status = ({ time, altitude, velocity, fuel }: Craft): Line =>
  row([`${time}s`, altitude.toFixed(0), velocity.toFixed(1), fuel.toFixed(0)]);

const outcome = (speed: number): string => {
  if (speed <= 2) return 'Perfect touchdown. The crew will buy you a drink.';
  if (speed <= 5) return 'Good landing. A few bruises, nothing a report cannot fix.';
  if (speed <= 10) return 'Hard landing. The craft is damaged, but everyone walks away.';
  return `No survivors. You dug a new crater ${(speed * 0.4).toFixed(1)} m deep.`;
};

const landing = (speed: number, time: number): Line[] => [
  blank(),
  line('Contact at ', bright(`${speed.toFixed(2)} m/s`), dim(` after ${time.toFixed(1)} s.`)),
  line(outcome(speed)),
  blank(),
  playAgain('lander'),
];

const turn = (craft: Craft): Session => ({
  prompt: craft.fuel > 0 ? `burn 0-${MAX_BURN}>` : 'falling, press Enter>',
  input: (text): SessionStep => {
    const burn = text === '' ? 0 : Number(text);
    if (!Number.isFinite(burn) || burn < 0 || burn > MAX_BURN) {
      return { lines: [line(dim(`Burn rate from 0 to ${MAX_BURN}.`))], next: turn(craft) };
    }

    const flight = fly(craft, burn);
    if (flight.landed) return { lines: landing(flight.speed, flight.time) };

    const lines = [status(flight.craft)];
    if (flight.craft.fuel === 0 && craft.fuel > 0) lines.push(line(bright('FUEL EXHAUSTED.')));
    return { lines, next: turn(flight.craft) };
  },
});

export const lander: Command = {
  name: 'lander',
  summary: 'Land on the Moon in one piece',
  run: () => ({
    lines: [
      line('Descent stage, 1000 m above the surface and falling.'),
      line(
        `Each turn lasts ${TURN} s and gravity adds ${(GRAVITY * TURN).toFixed(1)} m/s. `,
        `Enter a burn rate from 0 to ${MAX_BURN}: each unit takes ${(THRUST * TURN).toFixed(1)} m/s `,
        'off and costs one unit of fuel. Touch down below 5 m/s.',
      ),
      quitHint(),
      blank(),
      row(COLUMNS),
      status(START),
    ],
    session: turn(START),
  }),
};
