import { action, art, blank, bright, dim, line, paced, toPlainText } from '../terminal/line';
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

const bannerRows = art(banner);
const bannerColumns = Math.max(...bannerRows.map((row) => toPlainText(row).length));

/** The greeting printed once the terminal has booted. */
export const welcome = (): Line[] => [
  // Wide screens: just right of the banner, and as tall.
  {
    spans: [],
    image: { ...photo, rows: bannerRows.length, columns: bannerColumns, side: 'art' },
    screen: 'wide',
  },
  ...bannerRows,
  blank(),
  // Narrow screens: as tall as the five rows that follow, which run down its right side.
  { spans: [], image: { ...photo, rows: 5, side: 'left' }, screen: 'narrow' },
  line(bright(profile.name), ` - ${profile.title}`),
  line(dim(profile.focus)),
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
