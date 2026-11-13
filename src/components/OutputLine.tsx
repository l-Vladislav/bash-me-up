import type { CSSProperties, MouseEvent } from 'react';
import type { Line, Span } from '../terminal/line';
import styles from './Terminal.module.css';

interface OutputLineProps {
  line: Line;
  onCommand: (command: string) => void;
}

const classNames = (...names: (string | false | undefined)[]): string =>
  names.filter(Boolean).join(' ');

const hangingIndent = (characters: number): CSSProperties => ({
  paddingLeft: `${characters}ch`,
  textIndent: `-${characters}ch`,
});

function SpanView({ span, onCommand }: { span: Span; onCommand: (command: string) => void }) {
  const className = classNames(
    styles[span.tone ?? 'normal'],
    span.hideBelow === 'medium' && styles.hideBelowMedium,
    span.hideBelow === 'wide' && styles.hideBelowWide,
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

  return (
    <div
      className={classNames(
        styles.line,
        line.art && styles.art,
        line.nowrap && styles.nowrap,
        command && styles.row,
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
