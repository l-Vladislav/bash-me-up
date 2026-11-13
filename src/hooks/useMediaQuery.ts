import { useSyncExternalStore } from 'react';

/** Touch screens, where focusing the prompt would pop up a keyboard. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

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
