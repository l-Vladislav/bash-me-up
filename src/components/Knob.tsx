import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import styles from './Knob.module.css';

interface KnobProps {
  label: string;
  /** Position from 0 (fully anticlockwise) to 1 (fully clockwise). */
  value: number;
  onChange: (value: number) => void;
}

/** Degrees of rotation between the two end stops. */
const SWEEP = 270;
const KEY_STEP = 0.05;
/** Pixels of vertical drag for a full sweep. */
const DRAG_RANGE = 140;
const CENTRE = 0.5;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** A rotary control: drag up or down, use the arrow keys, double-click to centre. */
export function Knob({ label, value, onChange }: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, value };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const start = drag.current;
    if (start) onChange(clamp(start.value + (start.y - event.clientY) / DRAG_RANGE));
  };

  const handlePointerEnd = (): void => {
    drag.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const targets: Record<string, number> = {
      ArrowUp: value + KEY_STEP,
      ArrowRight: value + KEY_STEP,
      ArrowDown: value - KEY_STEP,
      ArrowLeft: value - KEY_STEP,
      Home: 0,
      End: 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;

    event.preventDefault();
    onChange(clamp(target));
  };

  return (
    <div className={styles.knob}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className={styles.dial}
        style={{ rotate: `${(value - CENTRE) * SWEEP}deg` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={() => onChange(CENTRE)}
        onKeyDown={handleKeyDown}
      />
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
