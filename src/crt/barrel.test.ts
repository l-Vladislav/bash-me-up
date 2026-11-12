import { describe, expect, it } from 'vitest';
import { displacementScale, encodeDisplacement } from './barrel';

const square = { width: 800, height: 800 };
const wide = { width: 1600, height: 800 };

/** Decodes a channel value back to the pixel offset the filter will apply. */
const toPixels = (channel: number, scale: number): number => (channel / 255 - 0.5) * scale;

describe('encodeDisplacement', () => {
  it('leaves the centre of the screen untouched', () => {
    const [red, green] = encodeDisplacement(0, 0, square);
    // 128 is the closest an 8-bit channel gets to the neutral 0.5.
    expect([red, green]).toEqual([128, 128]);
  });

  it('pushes samples outward, hardest in the corners', () => {
    const [edge] = encodeDisplacement(1, 0, square);
    const [corner] = encodeDisplacement(1, 1, square);
    const [opposite] = encodeDisplacement(-1, -1, square);

    expect(edge).toBeGreaterThan(128);
    expect(corner).toBeGreaterThan(edge);
    expect(corner).toBe(255);
    expect(opposite).toBe(0);
  });

  it('round-trips to strength * r^2 * half-extent on each axis', () => {
    const strength = 0.04;
    const scale = displacementScale(wide, strength);
    const [red, green] = encodeDisplacement(1, 1, wide);

    // At the corner r^2 = 2, so the offset is 2 * strength * half the extent.
    expect(toPixels(red, scale)).toBeCloseTo(2 * strength * (wide.width / 2), 0);
    expect(toPixels(green, scale)).toBeCloseTo(2 * strength * (wide.height / 2), 0);
  });
});
