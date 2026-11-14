/**
 * Barrel distortion for the CRT glass.
 *
 * An SVG `feDisplacementMap` moves every pixel by an offset read from a map
 * image: red drives X, green drives Y, and 0.5 means "stay put". To imitate a
 * convex tube each output pixel samples the source further from the centre,
 * growing with the squared radius:
 *
 *   source = p * (1 + strength * |p|^2),  p in [-1, 1] on both axes
 *
 * The map is tiny (it is a smooth gradient, so the browser's bilinear
 * upscaling loses nothing) and only depends on the aspect ratio.
 */

import { isSoftwareRendering } from './renderer';

const MAP_SIZE = 96;

/** |p|^2 peaks at 2 in the corners; dividing by 4 keeps offsets in [-0.5, 0.5]. */
const NORMALISER = 4;

export interface Size {
  width: number;
  height: number;
}

/**
 * Encodes the displacement of the point (`nx`, `ny`), each in [-1, 1], as the
 * red and green channel values (0-255) of the map.
 */
export const encodeDisplacement = (nx: number, ny: number, size: Size): [number, number] => {
  const longest = Math.max(size.width, size.height);
  const radiusSquared = nx * nx + ny * ny;
  const encode = (axis: number, extent: number): number =>
    Math.round(255 * (0.5 + ((axis * radiusSquared) / NORMALISER) * (extent / longest)));

  return [encode(nx, size.width), encode(ny, size.height)];
};

/** The `scale` attribute that turns map values back into pixel offsets. */
export const displacementScale = (size: Size, strength: number): number =>
  (NORMALISER / 2) * strength * Math.max(size.width, size.height);

/** Renders the displacement map for a screen of the given size as a data URL. */
export const createBarrelMap = (size: Size): string => {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;

  const context = canvas.getContext('2d');
  if (!context) return '';

  const image = context.createImageData(MAP_SIZE, MAP_SIZE);
  // Sample at pixel centres so the stretched map lines up with the screen edges.
  const toUnit = (index: number): number => ((index + 0.5) / MAP_SIZE) * 2 - 1;

  for (let y = 0; y < MAP_SIZE; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const [red, green] = encodeDisplacement(toUnit(x), toUnit(y), size);
      const offset = (y * MAP_SIZE + x) * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = 0;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Whether to bend the image at all. Safari cannot feed `feImage` into a filter
 * applied to HTML, and on phones or without a GPU the effect costs more than
 * it adds.
 */
export const supportsBarrel = (): boolean => {
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const isLargeScreen = window.matchMedia('(min-width: 720px) and (min-height: 480px)').matches;
  return !isSafari && isLargeScreen && !isSoftwareRendering();
};
