import type { CSSProperties } from 'react';
import styles from './Backdrop.module.css';

/** How an indicator lamp behaves; each maps to a keyframe animation. */
type Pattern = 'blink' | 'activity' | 'pulse' | 'meter';

interface Lamp {
  /** Centre of the lamp, in percent of the photo's width and height. */
  x: number;
  y: number;
  pattern: Pattern;
  /** Diameter in percent of the photo's width. */
  size?: number;
}

/** Seconds per cycle; each lamp runs a little faster or slower than this. */
const PERIOD: Record<Pattern, number> = { blink: 1.6, activity: 2.4, pulse: 4, meter: 0.9 };

/** Lamps of the background photo, traced by hand over its bokeh highlights. */
const LAMPS: readonly Lamp[] = [
  // Tape deck and the racks on the left
  { x: 14.4, y: 35.8, pattern: 'blink' },
  { x: 23.2, y: 36.9, pattern: 'activity' },
  { x: 16.5, y: 48.4, pattern: 'meter', size: 6 },
  { x: 22.9, y: 48.4, pattern: 'meter', size: 6 },
  { x: 1.8, y: 29.1, pattern: 'pulse' },
  { x: 1.2, y: 45.1, pattern: 'blink' },
  { x: 9.5, y: 68.3, pattern: 'activity' },
  { x: 1.5, y: 78.1, pattern: 'pulse' },
  { x: 21.6, y: 59.3, pattern: 'blink' },
  { x: 9.7, y: 89.8, pattern: 'pulse' },
  { x: 19.6, y: 68.0, pattern: 'activity' },
  { x: 32.3, y: 47.3, pattern: 'blink' },
  { x: 34.3, y: 47.3, pattern: 'activity' },
  { x: 32.0, y: 25.8, pattern: 'blink' },
  { x: 39.1, y: 27.4, pattern: 'pulse' },
  { x: 39.2, y: 56.9, pattern: 'activity' },
  { x: 35.5, y: 5.3, pattern: 'blink' },
  // Centre, mostly behind the monitor on smaller screens
  { x: 59.7, y: 39.7, pattern: 'blink' },
  { x: 61.0, y: 30.5, pattern: 'pulse' },
  { x: 53.9, y: 79.7, pattern: 'activity' },
  // Oscilloscope stack and the racks on the right
  { x: 71.5, y: 54.1, pattern: 'blink' },
  { x: 71.6, y: 42.2, pattern: 'activity' },
  { x: 74.8, y: 42.2, pattern: 'blink' },
  { x: 76.7, y: 60.1, pattern: 'activity' },
  { x: 80.8, y: 41.9, pattern: 'pulse' },
  { x: 82.2, y: 60.3, pattern: 'pulse' },
  { x: 84.4, y: 34.1, pattern: 'blink' },
  { x: 84.4, y: 54.1, pattern: 'activity' },
  { x: 91.6, y: 79.5, pattern: 'pulse' },
  { x: 94.4, y: 24.0, pattern: 'pulse' },
  { x: 95.6, y: 35.4, pattern: 'activity' },
  { x: 96.8, y: 55.4, pattern: 'blink' },
  { x: 97.2, y: 79.2, pattern: 'activity' },
  { x: 97.2, y: 88.8, pattern: 'blink' },
  { x: 98.0, y: 35.4, pattern: 'blink' },
];

/** Deterministic 0..1 noise, so lamps drift out of step without Math.random. */
const noise = (seed: number): number => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const lampStyle = ({ x, y, pattern, size = 2.2 }: Lamp, index: number): CSSProperties => {
  const period = PERIOD[pattern] * (0.7 + noise(index) * 0.6);
  return {
    '--x': `${x}%`,
    '--y': `${y}%`,
    '--size': `${size}%`,
    // A negative delay starts each lamp somewhere mid-cycle.
    animationDuration: `${period.toFixed(2)}s`,
    animationDelay: `${(-noise(index + 100) * period).toFixed(2)}s`,
  } as CSSProperties;
};

/**
 * The room behind the terminal: a defocused photo of old equipment whose
 * indicator lamps keep blinking. Each lamp is a glow over a highlight in the
 * photo; fading the glow in and out makes the lamp flare up and settle.
 */
export function Backdrop() {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.photo}>
        {LAMPS.map((lamp, index) => (
          <span
            key={`${lamp.x}:${lamp.y}`}
            className={[styles.lamp, styles[lamp.pattern]].join(' ')}
            style={lampStyle(lamp, index)}
          />
        ))}
      </div>
    </div>
  );
}
