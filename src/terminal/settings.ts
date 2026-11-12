export const PHOSPHORS = ['amber', 'green'] as const;

export type Phosphor = (typeof PHOSPHORS)[number];

export interface Settings {
  /** Colour of the monochrome phosphor coating. */
  phosphor: Phosphor;
  /** Whether the CRT simulation (curvature, scanlines, flicker) is on. */
  crt: boolean;
}

export const DEFAULT_SETTINGS: Settings = { phosphor: 'amber', crt: true };

export const isPhosphor = (value: unknown): value is Phosphor =>
  PHOSPHORS.includes(value as Phosphor);

/** Parses persisted settings, falling back to defaults for anything malformed. */
export const parseSettings = (raw: string | null): Settings => {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const stored = JSON.parse(raw) as Partial<Settings> | null;
    return {
      phosphor: isPhosphor(stored?.phosphor) ? stored.phosphor : DEFAULT_SETTINGS.phosphor,
      crt: typeof stored?.crt === 'boolean' ? stored.crt : DEFAULT_SETTINGS.crt,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};
