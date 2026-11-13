import { action, art, blank, bright, dim, line, paced, toPlainText } from '../terminal/line';
import type { Line, Picture } from '../terminal/line';
import portrait from '../assets/gallery/portraits/portrait.png';
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

/**
 * On a wide screen the portrait sits right of the banner. The self test puts
 * it in that very spot, so when the test is wiped the picture simply stays.
 */
const besideBanner: Picture = {
  ...photo,
  rows: bannerRows.length,
  columns: Math.max(...bannerRows.map((row) => toPlainText(row).length)),
  side: 'art',
};

/** The greeting printed once the terminal has booted. */
export const welcome = (): Line[] => [
  // Wide screens: right of the banner, and as tall; already there since the self test.
  { spans: [], image: { ...besideBanner, still: true }, screen: 'wide' },
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
      // The video memory test shows something worth looking at, where it will stay.
      { spans: [], image: besideBanner, screen: 'wide' },
      line(bright(terminal.title), dim(`   ${terminal.rom}`)),
      blank(),
      // Narrow screens put it elsewhere on the welcome, so here it just sits right.
      { spans: [], image: { ...photo, rows: 10, side: 'right' }, screen: 'narrow' },
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
