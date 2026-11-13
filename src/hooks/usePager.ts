import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface Pager {
  /** Share of the output read so far, 0-100; `null` once everything is in view. */
  progress: number | null;
  /** Scrolls one screenful further, keeping the last row for context. */
  next: () => void;
  /** Re-reads the scroll position; call from the viewport's `scroll` event. */
  onScroll: () => void;
}

/** Scroll positions are fractional on zoomed or high-DPI screens. */
const TOLERANCE = 2;

const px = (value: string): number => Number.parseFloat(value) || 0;

/**
 * Pages output like `more`: when a command prints more than fits on the
 * screen, the view stops at its first page instead of running to the end, and
 * `next` steps through the rest. Output that fits simply follows the newest
 * line, as before. Pages start at the last echoed command line, or at the top
 * of the screen for output nobody typed, such as the boot sequence.
 */
export const usePager = (viewportRef: RefObject<HTMLElement | null>): Pager => {
  const [progress, setProgress] = useState<number | null>(null);
  /** The page start the view is holding on; `null` once the reader takes over. */
  const anchorRef = useRef<Element | null>(null);
  const followRef = useRef(true);
  /** The last position set from code, to tell it apart from the reader scrolling. */
  const placedRef = useRef<number | null>(null);

  const measure = (element: HTMLElement): void => {
    const { scrollTop, clientHeight, scrollHeight } = element;
    const rest = scrollHeight - clientHeight - scrollTop;
    setProgress(
      rest > TOLERANCE ? Math.round(((scrollTop + clientHeight) / scrollHeight) * 100) : null,
    );
  };

  const scrollTo = (element: HTMLElement, top: number): void => {
    element.scrollTop = top;
    placedRef.current = element.scrollTop;
    measure(element);
  };

  /** Shows the newest output, or the first page of it when it does not fit. */
  const place = (element: HTMLElement): void => {
    const echoes = element.querySelectorAll('[data-echo]');
    const anchor = echoes[echoes.length - 1] ?? null;
    if (anchor !== anchorRef.current) {
      anchorRef.current = anchor;
      followRef.current = true;
    }
    if (!followRef.current) {
      measure(element);
      return;
    }

    const end = element.scrollHeight - element.clientHeight;
    const pageStart =
      anchor instanceof HTMLElement
        ? anchor.offsetTop - px(getComputedStyle(element).paddingTop)
        : 0;
    scrollTo(element, Math.max(0, Math.min(end, pageStart)));
  };

  // After every render, since any printed line can push the output past the screen.
  useLayoutEffect(() => {
    if (viewportRef.current) place(viewportRef.current);
  });

  // A keyboard sliding up or a rotated phone changes how much fits on a page.
  const handleResize = useEffectEvent((element: HTMLElement) => place(element));
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => handleResize(element));
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  const next = (): void => {
    const element = viewportRef.current;
    if (!element) return;
    const style = getComputedStyle(element);
    // Bottom padding only shows at the very end, so mid-page the text runs to the edge.
    const page = element.clientHeight - px(style.paddingTop) - px(style.lineHeight);
    followRef.current = false;
    scrollTo(element, element.scrollTop + Math.max(page, px(style.lineHeight)));
  };

  const onScroll = (): void => {
    const element = viewportRef.current;
    if (!element) return;
    // The reader scrolled by hand: stop pinning the view to the page start.
    if (placedRef.current !== null && Math.abs(element.scrollTop - placedRef.current) > TOLERANCE) {
      followRef.current = false;
      placedRef.current = null;
    }
    measure(element);
  };

  return { progress, next, onScroll };
};
