import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Size } from '../crt/barrel';

const EMPTY: Size = { width: 0, height: 0 };

/** Tracks an element's rendered size in whole pixels. */
export const useElementSize = (ref: RefObject<HTMLElement | null>): Size => {
  const [size, setSize] = useState(EMPTY);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};
