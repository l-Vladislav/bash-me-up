import type { CSSProperties, MouseEvent } from 'react';
import type { Line, Span } from '../terminal/line';
import styles from './Terminal.module.css';

interface OutputLineProps {
  line: Line;
  onCommand: (command: string) => void;
}

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

  return <span className={className}>{span.text}</span>;
}

export function OutputLine({ line, onCommand }: OutputLineProps) {
  const { command } = line;

  // Buttons and links inside the row handle their own clicks.
  const handleRowClick = (event: MouseEvent<HTMLDivElement>): void => {
    const onControl = event.target instanceof Element && event.target.closest('button, a');
    if (command && !onControl) onCommand(command);
  };

  if (line.image) {
    const { src, alt, rows, side } = line.image;
    // The glow sits on the wrapper: a filter on the masked element itself would be cut off.
    return (
      <div
        className={classNames(
          styles.picture,
          side === 'left' && styles.pictureLeft,
          side === 'block' && styles.pictureBlock,
          line.screen === 'wide' && styles.onlyWide,
          line.screen === 'narrow' && styles.onlyNarrow,
        )}
        role="img"
        aria-label={alt}
      >
        <div
          className={styles.pictureMask}
          style={{ '--src': `url("${src}")`, '--rows': rows } as CSSProperties}
        />
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
        line.spans.some((span) => span.breakBelow) && styles.stack,
      )}
      style={line.hang ? hangingIndent(line.hang) : undefined}
      aria-hidden={line.art}
      data-echo={line.echo || undefined}
      data-command={command}
      onClick={command ? handleRowClick : undefined}
    >
      {line.spans.map((span, index) => (
        <SpanView key={index} span={span} onCommand={onCommand} />
      ))}
    </div>
  );
}
