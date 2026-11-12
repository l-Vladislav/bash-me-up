import type { CSSProperties } from 'react';
import type { Line, Span } from '../terminal/line';
import styles from './Terminal.module.css';

interface OutputLineProps {
  line: Line;
  onCommand: (command: string) => void;
}

const hangingIndent = (characters: number): CSSProperties => ({
  paddingLeft: `${characters}ch`,
  textIndent: `-${characters}ch`,
});

function SpanView({ span, onCommand }: { span: Span; onCommand: (command: string) => void }) {
  const className = styles[span.tone ?? 'normal'];

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
  return (
    <div
      className={line.art ? `${styles.line} ${styles.art}` : styles.line}
      style={line.hang ? hangingIndent(line.hang) : undefined}
      aria-hidden={line.art}
    >
      {line.spans.map((span, index) => (
        <SpanView key={index} span={span} onCommand={onCommand} />
      ))}
    </div>
  );
}
