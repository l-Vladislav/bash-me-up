import styles from './PowerSwitch.module.css';

interface PowerSwitchProps {
  on: boolean;
  onChange: (on: boolean) => void;
}

/** A rocker switch: pressed in on the "I" side when the monitor is on. */
export function PowerSwitch({ on, onChange }: PowerSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Power"
      className={styles.rocker}
      onClick={() => onChange(!on)}
    >
      <span className={styles.half}>O</span>
      <span className={styles.half}>I</span>
    </button>
  );
}
