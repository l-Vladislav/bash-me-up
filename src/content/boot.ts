import { action, art, blank, bright, dim, line, paced } from '../terminal/line';
import type { Line } from '../terminal/line';
import portrait from '../assets/portrait.png';
import type { Phosphor, Settings } from '../terminal/settings';
import { banner, profile, terminal } from './resume';

const POST_STEP_MS = 170;
/** Long enough to see the portrait once it has finished drawing. */
const POST_DONE_MS = 1500;

/** Real-world designations of the phosphor coatings being imitated. */
const PHOSPHOR_NAMES: Readonly<Record<Phosphor, string>> = { amber: 'P3 AMBER', green: 'P1 GREEN' };

const check = (label: string, result: string): Line =>
  line(dim(`${label} `.padEnd(22, '.')), ` ${result}`);

const photo = { src: portrait, alt: `Portrait of ${profile.name}` };

/** The greeting printed once the terminal has booted. */
export const welcome = (): Line[] => [
  ...art(banner),
  blank(),
  // Wide screens: as tall as the five rows that follow, which run down its right side.
  { spans: [], image: { ...photo, rows: 5, side: 'left' }, screen: 'wide' },
  line(bright(profile.name), ` - ${profile.title}`),
  line(dim(profile.focus)),
  // Phones: under the name, where it has the width to itself.
  { spans: [], image: { ...photo, rows: 6, side: 'block' }, screen: 'narrow' },
  blank(),
  line('Type ', action('help'), ' to list commands, or start with ', action('about'), '.'),
  blank(),
];

/** A power-on self test in the spirit of an early-80s video terminal. */
const selfTest = (settings: Settings): Line[] =>
  paced(
    [
      line(bright(terminal.title), dim(`   ${terminal.rom}`)),
      blank(),
      // The video memory test shows something worth looking at.
      { spans: [], image: { ...photo, rows: 10, side: 'right' } },
      ...terminal.bootChecks.map(({ label, result }) => check(label, result)),
      check('PHOSPHOR', PHOSPHOR_NAMES[settings.phosphor]),
    ],
    POST_STEP_MS,
  );

/** Everything printed when the terminal is switched on. */
export const bootSequence = (settings: Settings): Line[] => {
  const [first = blank(), ...rest] = welcome();

  return [
    ...selfTest(settings),
    // Wipe the self test off the screen once it has passed.
    { ...first, clear: true, delay: POST_DONE_MS },
    ...rest,
  ];
};
