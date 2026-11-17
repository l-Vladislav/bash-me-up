import type { ReactNode } from 'react';
import styles from './PushButton.module.css';

interface PushButtonProps {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
  /** The symbol printed on the cap. */
  children: ReactNode;
  /** The symbol glows in the phosphor colour while the button is in. */
  lit?: boolean;
}

/**
 * A square push-on, push-off button: one press latches it in, the next lets
 * it spring back out. In means on.
 */
export function PushButton({ label, on, onChange, children, lit = false }: PushButtonProps) {
  return (
    <div className={styles.unit}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        title={`${label}: ${on ? 'on' : 'off'}`}
        className={lit ? `${styles.bezel} ${styles.lit}` : styles.bezel}
        onClick={() => onChange(!on)}
      >
        <span className={styles.cap}>{children}</span>
      </button>
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}

/** IEC 60417-5009, the power symbol. */
export const PowerSymbol = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M6 1.2v4.3M3.4 2.9a4 4 0 1 0 5.2 0" />
  </svg>
);

/** A loudspeaker with sound coming out of it. */
export const SpeakerSymbol = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path d="M1.5 4.5h2l2.5-2.2v7.4L3.5 7.5h-2z" className={styles.solid} />
    <path d="M8 4.2a2.6 2.6 0 0 1 0 3.6M9.6 2.7a4.8 4.8 0 0 1 0 6.6" />
  </svg>
);
