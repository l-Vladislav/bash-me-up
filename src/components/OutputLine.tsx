import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { chatter } from '../audio/sound';
import { REDUCED_MOTION_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import type { Line, Motion, Span } from '../terminal/line';
import styles from './Terminal.module.css';

interface OutputLineProps {
  line: Line;
  onCommand: (command: string) => void;
  /** Shows an animated row as it ends up, e.g. in the afterimage of a wiped screen. */
  still?: boolean;
}

/**
 * The spans a row shows right now: the current frame of its animation, or the
 * row itself once the frames have played (or at once, for visitors who asked
 * for reduced motion).
 */
const textLength = (spans: readonly Span[]): number =>
  spans.reduce((total, span) => total + span.text.replace(/\s/g, '').length, 0);

const useFrames = ({ spans, frames, loop = false }: Line, still: boolean): readonly Span[] => {
  const [at, setAt] = useState(0);
  const reduced = useMediaQuery(REDUCED_MOTION_QUERY);
  const count = frames?.length ?? 0;
  const frame = still || reduced ? undefined : frames?.[at];

  useEffect(() => {
    if (!frame) return undefined;
    const timer = setTimeout(() => {
      // The row redrawn: it chatters like fresh output. A looping row would never stop.
      if (!loop) chatter(textLength(frames?.[at + 1]?.spans ?? spans));
      setAt(loop ? (at + 1) % count : at + 1);
    }, frame.ms);
    return () => clearTimeout(timer);
  }, [frame, at, loop, count, frames, spans]);

  return frame?.spans ?? spans;
};

const classNames = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(' ');

/** Read by the `.hang` class; capped there, so wrapped text always keeps some room. */
const hangingIndent = (characters: number): CSSProperties =>
  ({ '--hang': `${characters}ch` }) as CSSProperties;

function SpanView({ span, onCommand }: { span: Span; onCommand: (command: string) => void }) {
  const className = classNames(
    styles[span.tone ?? 'normal'],
    span.hideBelow === 'medium' && styles.hideBelowMedium,
    span.hideBelow === 'wide' && styles.hideBelowWide,
    span.breakBelow === 'medium' && styles.breakBelowMedium,
    span.showBelow === 'medium' && styles.showBelowMedium,
  );

  if (span.href) {
    return (
      <a
        className={`${className} ${styles.interactive}`}
        href={span.href}
        target="_blank"
        rel="noreferrer"
      >
        {span.text}
      </a>
    );
  }

  if (span.command) {
    const { command } = span;
    return (
      <button
        type="button"
        className={`${className} ${styles.interactive}`}
        title={`Run "${command}"`}
        onClick={() => onCommand(command)}
      >
        {span.text}
      </button>
    );
  }

  const style = span.indent ? { paddingLeft: `${span.indent}ch` } : undefined;
  return (
    <span className={className} style={style}>
      {span.text}
    </span>
  );
}

const MOTIONS: Readonly<Record<Motion, string | undefined>> = {
  advance: styles.motionAdvance,
  left: styles.motionLeft,
  right: styles.motionRight,
  back: styles.motionBack,
  blink: styles.motionBlink,
  lunge: styles.motionLunge,
  clash: styles.motionClash,
  shake: styles.motionShake,
};

/** Fetches the pictures that may come after this one while the visitor looks at it. */
const usePreload = (sources: readonly string[] | undefined): void => {
  useEffect(() => {
    for (const src of sources ?? []) new Image().src = src;
  }, [sources]);
};

export function OutputLine({ line, onCommand, still = false }: OutputLineProps) {
  const { command } = line;
  const spans = useFrames(line, still);
  usePreload(still ? undefined : line.image?.upcoming);

  // Buttons and links inside the row handle their own clicks.
  const handleRowClick = (event: MouseEvent<HTMLDivElement>): void => {
    const onControl = event.target instanceof Element && event.target.closest('button, a');
    if (command && !onControl) onCommand(command);
  };

  if (line.image) {
    const { src, alt, rows, side, columns = 0, still = false, motion, after = 0 } = line.image;
    // The glow sits on the wrapper: a filter on the masked element itself would be cut off.
    return (
      <div
        className={classNames(
          styles.picture,
          side === 'left' && styles.pictureLeft,
          side === 'art' && styles.pictureArt,
          side === 'block' && styles.pictureBlock,
          side === 'scene' && styles.pictureScene,
          still && styles.pictureStill,
          !still && motion && MOTIONS[motion],
          line.screen === 'broad' && styles.onlyBroad,
          line.screen === 'wide' && styles.onlyWide,
          line.screen === 'narrow' && styles.onlyNarrow,
        )}
        // Sizes on the wrapper: its margin needs them as much as the picture does.
        style={{ '--rows': rows, '--cols': columns, '--after': `${after}ms` } as CSSProperties}
        role="img"
        aria-label={alt}
      >
        <div className={styles.pictureMask} style={{ '--src': `url("${src}")` } as CSSProperties}>
          {/* Invisible: it only gives the box the picture's own proportions. */}
          <img className={styles.pictureSizer} src={src} alt="" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        styles.line,
        line.art && styles.art,
        line.nowrap && styles.nowrap,
        command && styles.row,
        Boolean(line.hang) && styles.hang,
        spans.some((span) => span.breakBelow) && styles.stack,
      )}
      style={line.hang ? hangingIndent(line.hang) : undefined}
      aria-hidden={line.art}
      data-echo={line.echo || undefined}
      data-command={command}
      onClick={command ? handleRowClick : undefined}
    >
      {spans.map((span, index) => (
        <SpanView key={index} span={span} onCommand={onCommand} />
      ))}
    </div>
  );
}
