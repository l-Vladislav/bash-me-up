import { useSyncExternalStore } from 'react';

/** Touch screens, where focusing the prompt would pop up a keyboard. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Visitors who asked their system for less movement on screen. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Whether a CSS media query currently matches; updates when it changes. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
