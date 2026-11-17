import { useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent, WheelEvent } from 'react';
import { detents } from '../audio/sound';
import styles from './Knob.module.css';

interface KnobProps {
  label: string;
  /** Position from 0 (fully anticlockwise) to 1 (fully clockwise). */
  value: number;
  onChange: (value: number) => void;
}

/** Degrees of rotation between the two end stops. */
const SWEEP = 270;
/**
 * Steps the knob clicks into over its sweep. Each is 15 degrees, one rib of
 * its edge (see `--rib` in Knob.module.css), so the ribs move on by exactly
 * one per click; and the count is even, so the centre is a step too.
 */
const DETENTS = 18;
/** Pixels of vertical drag for a full sweep. */
const DRAG_RANGE = 140;
const CENTRE = 0.5;

/** A step that exists: from 0, the anticlockwise stop, to DETENTS, the clockwise one. */
const stop = (step: number): number => Math.min(DETENTS, Math.max(0, step));

/** The step nearest to `value` (0 to 1). */
const notch = (value: number): number => stop(Math.round(value * DETENTS));

/** A rotary control: drag, scroll the wheel, use the arrow keys, double-click to centre. */
export function Knob({ label, value, onChange: change }: KnobProps) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const step = notch(value);
  // Where the knob was last turned to. Pointer moves can come faster than the
  // knob re-renders; counting from here, no notch is clicked twice.
  const turned = useRef(step);
  // Follows a value changed from outside too, e.g. a stored setting.
  useLayoutEffect(() => {
    turned.current = step;
  }, [step]);

  /** Turns the knob to a step, clicking once for every step it passes. */
  const turnTo = (target: number): void => {
    const next = stop(target);
    const from = turned.current;
    // An old setting between two steps still settles into one, silently.
    if (next === from && value === next / DETENTS) return;
    turned.current = next;
    detents(Math.abs(next - from));
    change(next / DETENTS);
  };

  /** Turns to wherever `next` (0 to 1) falls, settling into the nearest step. */
  const onChange = (next: number): void => turnTo(notch(next));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, value };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const start = drag.current;
    if (start) onChange(start.value + (start.y - event.clientY) / DRAG_RANGE);
  };

  const handlePointerEnd = (): void => {
    drag.current = null;
  };

  // Scrolling up turns the knob clockwise, one step per notch of the wheel.
  const handleWheel = (event: WheelEvent<HTMLDivElement>): void => {
    if (event.deltaY !== 0) turnTo(step - Math.sign(event.deltaY));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const targets: Record<string, number> = {
      ArrowUp: step + 1,
      ArrowRight: step + 1,
      ArrowDown: step - 1,
      ArrowLeft: step - 1,
      Home: 0,
      End: DETENTS,
    };
    const target = targets[event.key];
    if (target === undefined) return;

    event.preventDefault();
    turnTo(target);
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
        onWheel={handleWheel}
        onDoubleClick={() => onChange(CENTRE)}
        onKeyDown={handleKeyDown}
      />
      <span className={styles.label} aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
