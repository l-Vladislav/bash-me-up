export const PHOSPHORS = ['amber', 'green'] as const;

export type Phosphor = (typeof PHOSPHORS)[number];

export interface Settings {
  /** Colour of the monochrome phosphor coating. */
  phosphor: Phosphor;
  /** Whether the CRT simulation (curvature, scanlines, flicker) is on. */
  crt: boolean;
  /** Position of the brightness knob, from 0 to 1. */
  brightness: number;
  /** Position of the contrast knob, from 0 to 1. */
  contrast: number;
}

export const DEFAULT_SETTINGS: Settings = {
  phosphor: 'amber',
  crt: true,
  brightness: 0.5,
  contrast: 0.5,
};

export const isPhosphor = (value: unknown): value is Phosphor =>
  PHOSPHORS.includes(value as Phosphor);

const isKnobPosition = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1;

/** Parses persisted settings, falling back to defaults for anything malformed. */
export const parseSettings = (raw: string | null): Settings => {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(raw) as Partial<Settings> | null;
    return {
      phosphor: isPhosphor(stored?.phosphor) ? stored.phosphor : DEFAULT_SETTINGS.phosphor,
      crt: typeof stored?.crt === 'boolean' ? stored.crt : DEFAULT_SETTINGS.crt,
      brightness: isKnobPosition(stored?.brightness)
        ? stored.brightness
        : DEFAULT_SETTINGS.brightness,
      contrast: isKnobPosition(stored?.contrast) ? stored.contrast : DEFAULT_SETTINGS.contrast,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};
