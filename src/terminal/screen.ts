import type { Line } from './line';

export interface Entry {
  id: number;
  line: Line;
}

/**
 * What the tube is showing. Besides the live `entries` it remembers the
 * picture that was just wiped (`ghost`), so the view can let it fade out the
 * way slow phosphor keeps glowing after the beam has moved on.
 */
export interface Screen {
  entries: readonly Entry[];
  ghost: readonly Entry[];
  /** Counts wipes; changes whenever `ghost` is replaced. */
  wipes: number;
}

export type ScreenAction =
  | { type: 'print'; entries: readonly Entry[] }
  /** Clears the screen; `trailing` is appended to the ghost only. */
  | { type: 'wipe'; trailing?: readonly Entry[] };

export const EMPTY_SCREEN: Screen = { entries: [], ghost: [], wipes: 0 };

export const screenReducer = (screen: Screen, action: ScreenAction): Screen => {
  switch (action.type) {
    case 'print': {
      // A form feed inside the batch wipes everything printed before it.
      const formFeed = action.entries.findLastIndex((entry) => entry.line.clear);
      if (formFeed === -1) {
        return { ...screen, entries: [...screen.entries, ...action.entries] };
      }
      return {
        entries: action.entries.slice(formFeed),
        ghost: [...screen.entries, ...action.entries.slice(0, formFeed)],
        wipes: screen.wipes + 1,
      };
    }
    case 'wipe':
      return {
        entries: [],
        ghost: [...screen.entries, ...(action.trailing ?? [])],
        wipes: screen.wipes + 1,
      };
  }
};
