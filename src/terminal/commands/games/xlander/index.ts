/**
 * `xlander`: bring a Super Heavy booster home from hot staging and into the
 * arms of the launch tower, the way SpaceX catches it. Every turn is a new
 * picture: from the black sky at staging, down through the clouds, into the
 * fire and steam of the landing burn.
 */
import { blank, bright, dim, heading, line } from '../../../line';
import type { Line, Span } from '../../../line';
import type { Command, Session, SessionStep } from '../../types';
import { playAgain, quitHint } from '../shared';
import {
  BOOSTBACK_KM,
  BURN_START,
  ENGINES,
  FUEL,
  GO_KM,
  GUST,
  HOVER,
  MAX_BOOSTBACK,
  MAX_GLIDE,
  REACH,
  boostback,
  fly,
  glide,
} from './flight';
import type { Booster } from './flight';
import { sceneOf } from './scenes';
import type { Entrance, Scene } from './scenes';

/** Seconds after liftoff of each stage of the flight, as on the webcasts. */
const STAGING = 160;
const BOOSTBACK_START = 165;
const APOGEE = 250;
const THICK_AIR = 330;
const BURN = 376;

/** Where the impact point is at staging, in km east of the tower: somewhere in this range. */
const IMPACT_MIN = 95;
const IMPACT_SPREAD = 20;

/** At or below this speed, m/s, the arms catch the booster clean; below the next, they hold it. */
const CLEAN = 2;
const HARD = 6;

/** Below this many metres the booster is among the arms, not above them. */
const NEAR = 150;

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `T+${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const gauge = (label: string, value: string | Span): Line => line(dim(label.padEnd(10)), value);

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? '' : 's'}`;

/** Where the booster is off the arms, in words. */
const bearing = (metres: number): string => {
  if (metres === 0) return 'lined up with the arms';
  return `${Math.abs(metres).toFixed(0)} m ${metres > 0 ? 'east, out to sea' : 'west, inland'}`;
};

const kilometres = (km: number): string =>
  `${Math.abs(km).toFixed(1)} km ${km >= 0 ? 'east' : 'west'} of the tower`;

/** How a scene comes on after `before`: as it was, closer, or rattling. */
const entering = (scene: Scene, before: Scene | undefined): Entrance => {
  if (scene === before) return { still: true };
  if (scene === 'explosion' || scene === 'terminated' || scene === 'splashdown') {
    return { motion: 'shake', after: 400 };
  }
  if (before === 'falling' || before === 'burn' || before === 'hover') return { motion: 'advance' };
  return {};
};

/** A screen of the flight: the picture, and the story down its side. */
const screen = (
  scene: Scene,
  before: Scene | undefined,
  rows: readonly Line[],
  upcoming: readonly Scene[] = [],
): Line[] => [
  {
    spans: [],
    clear: before !== undefined,
    image: sceneOf(scene, entering(scene, before), upcoming),
  },
  ...rows,
];

/** A screen that ends the game: the picture, what became of the booster, and another go. */
const finale = (scene: Scene, before: Scene, story: readonly Line[]): SessionStep => ({
  lines: [...screen(scene, before, story), blank(), playAgain('xlander')],
});

/** Reads a whole number from `min` to `max`; empty input counts as `min`. */
const whole = (text: string, min: number, max: number): number | undefined => {
  const value = text === '' ? min : Number(text);
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
};

/** Reads a number from `min` to `max`, fractions too; empty input counts as `min`. */
const amount = (text: string, min: number, max: number): number | undefined => {
  const value = text === '' ? min : Number(text);
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
};

const retry = (message: string, session: Session): SessionStep => ({
  lines: [line(dim(message))],
  next: session,
});

// The landing burn.

/** The picture for a turn of the landing burn, from how high and whether the engines burn. */
const burning = (booster: Booster, engines: number): Scene => {
  if (booster.altitude <= NEAR) return 'hover';
  return engines > 0 ? 'burn' : 'falling';
};

const RULES = line(
  dim(
    `Engines 0-${ENGINES}: ${HOVER} hold a hover, ${ENGINES} brake at ` +
      `${(ENGINES / HOVER - 1).toFixed(1)} g, fractions throttle them (2.5 sinks slowly), ` +
      'and lit ones slide it towards the arms. ' +
      `Into the arms below ${HARD} m/s and within ${REACH} m.`,
  ),
);

const telemetry = (booster: Booster): Line[] => [
  gauge(clock(booster.time), bright('LANDING BURN')),
  gauge('ALTITUDE', `${booster.altitude.toFixed(0)} m above the arms`),
  gauge(
    'SPEED',
    `${Math.abs(booster.velocity).toFixed(1)} m/s ${booster.velocity >= 0 ? 'down' : 'up'}`,
  ),
  gauge('OFFSET', bearing(booster.offset)),
  gauge('FUEL', `${booster.fuel.toFixed(0)} engine-seconds`),
];

/** How the arms took the booster, if they did. */
const contact = (speed: number, offset: number, time: number, before: Scene): SessionStep => {
  const at = `${speed.toFixed(1)} m/s, ${clock(time)}`;
  if (Math.abs(offset) > REACH) {
    return finale('explosion', before, [
      line('Contact at ', bright(at), ', but ', bearing(offset), '.'),
      line('The booster slides past the arms and falls onto the launch mount.'),
      line(
        dim('Lit engines slide it sideways: light them earlier, or steer closer with the fins.'),
      ),
    ]);
  }
  if (speed <= CLEAN) {
    return finale('caught', before, [
      line(bright('CAUGHT. '), `Into the arms at ${at}.`),
      line('The arms close under the pins, the engines go quiet, steam drifts off the tower.'),
      line('Mechazilla has it. This booster flies again.'),
    ]);
  }
  if (speed <= HARD) {
    return finale('caught', before, [
      line(bright('CAUGHT, HARD. '), `Into the arms at ${at}.`),
      line('The arms hold it, but the pins are bent and the rails scraped:'),
      line('the tower is out for a week of repairs.'),
    ]);
  }
  return finale('explosion', before, [
    line('Into the arms at ', bright(at), '.'),
    line('They snap, and the booster takes the launch mount down with it.'),
  ]);
};

const landing = (booster: Booster, showing: Scene): Session => ({
  prompt: booster.fuel > 0 ? `engines 0-${ENGINES}>` : 'falling, press Enter>',
  input: (text): SessionStep => {
    const engines = booster.fuel > 0 ? amount(text, 0, ENGINES) : 0;
    if (engines === undefined) {
      return retry(
        `Engines from 0 to ${ENGINES}; 2.5 is three throttled down.`,
        landing(booster, showing),
      );
    }

    const flight = fly(booster, engines);
    if (flight.caught) return contact(flight.speed, flight.offset, flight.time, showing);

    const next = flight.booster;
    const scene = burning(next, engines);
    const notes: Line[] = [];
    if (next.fuel === 0 && booster.fuel > 0) notes.push(line(bright('FUEL EXHAUSTED.')));
    return {
      lines: screen(
        scene,
        showing,
        [...telemetry(next), ...notes, blank(), RULES],
        ['burn', 'hover', 'caught', 'explosion'],
      ),
      next: landing(next, scene),
    };
  },
});

// The glide down, from apogee to the landing burn.

interface Glide {
  /** Metres off the arms. */
  offset: number;
  /** The fins' turns so far, out of three. */
  turn: number;
}

const GLIDES: readonly { scene: Scene; time: number; story: string }[] = [
  {
    scene: 'boostback',
    time: BOOSTBACK_START,
    story: 'Over the top at 96 km and back down, the grid fins steer.',
  },
  {
    scene: 'coast',
    time: APOGEE,
    story: 'Apogee, 96 km. Engines first, the booster falls back towards the air.',
  },
  {
    scene: 'fins',
    time: THICK_AIR,
    story: 'Into the thick air at 20 km: the fins bite, and the wind with them.',
  },
];

const FINS_PROMPT = `fins 0-${MAX_GLIDE} m>`;

const finsRule = (): Line =>
  line(dim(`How many metres the fins should glide it towards the tower, up to ${MAX_GLIDE}.`));

/** The first screen of the landing burn, when the fins have done what they could. */
const burnStart = (offset: number): SessionStep => {
  const booster: Booster = { ...BURN_START, fuel: FUEL, offset, time: BURN };
  return {
    lines: screen(
      'falling',
      'fins',
      [
        ...telemetry(booster),
        blank(),
        line(`The booster falls at ${BURN_START.velocity} m/s. Light the engines in time.`),
        RULES,
      ],
      ['burn'],
    ),
    next: landing(booster, 'falling'),
  };
};

const gliding = (state: Glide, random: () => number): Session => ({
  prompt: FINS_PROMPT,
  input: (text): SessionStep => {
    const metres = whole(text, 0, MAX_GLIDE);
    if (metres === undefined) {
      return retry(`A whole number of metres from 0 to ${MAX_GLIDE}.`, gliding(state, random));
    }

    const gust = Math.round((random() * 2 - 1) * GUST);
    const offset = glide(state.offset, metres, gust);
    const turn = state.turn + 1;
    const stage = GLIDES[turn];
    if (!stage) return burnStart(offset);

    const before = GLIDES[state.turn]?.scene;
    return {
      lines: screen(
        stage.scene,
        before,
        [
          gauge(clock(stage.time), bright('DESCENT')),
          line(stage.story),
          line(
            dim(`The fins glide it ${metres} m towards the tower; `),
            dim(`a gust pushes it ${Math.abs(gust)} m ${gust >= 0 ? 'east' : 'west'}.`),
          ),
          blank(),
          gauge('OFFSET', bearing(offset)),
          blank(),
          finsRule(),
        ],
        [GLIDES[turn + 1]?.scene ?? 'falling'],
      ),
      next: gliding({ offset, turn }, random),
    };
  },
});

// Hot staging and the boostback burn.

const boosting = (impact: number, random: () => number): Session => ({
  prompt: `boostback 0-${MAX_BOOSTBACK} s>`,
  input: (text): SessionStep => {
    const seconds = whole(text, 0, MAX_BOOSTBACK);
    if (seconds === undefined) {
      return retry(
        `A whole number of seconds from 0 to ${MAX_BOOSTBACK}.`,
        boosting(impact, random),
      );
    }

    const aimed = boostback(impact, seconds);
    const burn = gauge(
      clock(BOOSTBACK_START + seconds),
      `Boostback burn: ${plural(seconds, 'second')} on thirteen engines.`,
    );
    const where = gauge('IMPACT', kilometres(aimed));

    if (aimed > GO_KM) {
      return finale('splashdown', 'staging', [
        burn,
        where,
        line('Flight director: ', bright('NO-GO FOR CATCH.')),
        line('The booster comes down far out in the Gulf and bursts on the water.'),
        line(dim('Nobody hurt, nothing caught. More boostback next time.')),
      ]);
    }
    if (aimed < -GO_KM) {
      return finale('terminated', 'staging', [
        burn,
        where,
        line('The booster is headed over the beach, the road and the town.'),
        line('Range safety: ', bright('FLIGHT TERMINATION.'), ' It is blown apart over the coast.'),
        line(dim('Less boostback next time.')),
      ]);
    }

    const offset = Math.round(aimed * 1000);
    return {
      lines: screen(
        'boostback',
        'staging',
        [
          burn,
          where,
          line('Flight director: ', bright('GO FOR CATCH.')),
          line(GLIDES[0]?.story ?? ''),
          blank(),
          gauge('OFFSET', bearing(offset)),
          blank(),
          finsRule(),
          line(dim(`Each turn of the fins, a gust may push it up to ${GUST} m either way.`)),
        ],
        ['coast'],
      ),
      next: gliding({ offset, turn: 0 }, random),
    };
  },
});

export const xlander: Command = {
  name: 'xlander',
  summary: 'Catch a Super Heavy booster with the tower',
  run: (_args, { random }) => {
    const impact = Math.round((IMPACT_MIN + random() * IMPACT_SPREAD) * 10) / 10;
    return {
      lines: [
        heading('x lander'),
        blank(),
        ...screen(
          'staging',
          undefined,
          [
            gauge(clock(STAGING), bright('HOT STAGING, 69 KM')),
            line(
              'The ship lights its engines and leaves you behind. You fly the Super Heavy booster,',
            ),
            line('still racing out over the Gulf. Bring it home to the tower at Starbase,'),
            line('into the arms that catch it in mid-air.'),
            blank(),
            gauge('IMPACT', kilometres(impact)),
            blank(),
            line(
              dim(
                `Each second of boostback burn pulls the impact point ${BOOSTBACK_KM} km back. ` +
                  `Within ${GO_KM} km of the tower, the flight director calls go for catch; ` +
                  'short of it the booster ends in the sea, past it over land it is blown up.',
              ),
            ),
            quitHint(),
          ],
          ['boostback', 'splashdown'],
        ),
      ],
      session: boosting(impact, random),
    };
  },
};
