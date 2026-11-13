import type { KeyboardEvent } from 'react';
import styles from './Selector.module.css';

export interface SelectorOption<T extends string> {
  value: T;
  /** Short legend printed on the panel beside the position. */
  legend: string;
}

interface SelectorProps<T extends string> {
  label: string;
  /** The anticlockwise and the clockwise position. */
  options: readonly [SelectorOption<T>, SelectorOption<T>];
  value: T;
  onChange: (value: T) => void;
}

/** Where the pointer rests at each end stop, in degrees from straight up. */
const ANGLE = 45;

/**
 * A two-position rotary switch: the knob clicks over from one marked position
 * to the other. Click the knob to turn it, click a legend to go straight
 * there, or use the arrow keys.
 */
export function Selector<T extends string>({ label, options, value, onChange }: SelectorProps<T>) {
  const [left, right] = options;
  const current = value === right.value ? right : left;
  const other = current === left ? right : left;

  const select = (option: SelectorOption<T>): void => {
    if (option.value !== value) onChange(option.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const target = { ArrowLeft: left, ArrowDown: left, ArrowRight: right, ArrowUp: right }[
      event.key
    ];
    if (!target) return;
    event.preventDefault();
    select(target);
  };

  const legend = (option: SelectorOption<T>) => (
    <span
      className={option === current ? `${styles.legend} ${styles.active}` : styles.legend}
      aria-hidden="true"
      onClick={() => select(option)}
    >
      {option.legend}
    </span>
  );

  return (
    <div className={styles.selector}>
      {legend(left)}
      <button
        type="button"
        className={styles.dial}
        style={{ rotate: `${current === left ? -ANGLE : ANGLE}deg` }}
        aria-label={`${label}: ${current.legend}`}
        title={`${label}: ${current.legend} (click for ${other.legend})`}
        onClick={() => select(other)}
        onKeyDown={handleKeyDown}
      />
      {legend(right)}
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
