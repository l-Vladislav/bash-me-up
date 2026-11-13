import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface Pager {
  /** Share of the output read so far, 0-100; `null` once everything is in view. */
  progress: number | null;
  /** Scrolls one screenful further, keeping the last row for context. */
  next: () => void;
  /** Re-reads the scroll position; call from the viewport's `scroll` event. */
  onScroll: () => void;
  /** Call from the viewport's `wheel` and `touchmove` events: the reader is scrolling. */
  onUserScroll: () => void;
}

/**
 * Where the view goes when the output or the screen changes:
 * - `page`: the start of the newest output, or the end if all of it fits;
 * - `end`: the very end, so the prompt stays in sight;
 * - `free`: nowhere; the reader has scrolled somewhere and stays there.
 */
type Mode = 'page' | 'end' | 'free';

/** Scroll positions are fractional on zoomed or high-DPI screens. */
const TOLERANCE = 2;

const px = (value: string): number => Number.parseFloat(value) || 0;

const restBelow = (element: HTMLElement): number =>
  element.scrollHeight - element.clientHeight - element.scrollTop;

/**
 * Pages output like `more`: when a command prints more than fits on the
 * screen, the view stops at its first page instead of running to the end, and
 * `next` steps through the rest. Output that fits simply follows the newest
 * line, as before. Pages start at the last echoed command line, or at the top
 * of the screen for output nobody typed, such as the boot sequence.
 *
 * Only the reader's own wheel or swipe counts as scrolling away. The browser
 * also moves the scroll position by itself, e.g. when the screen grows as the
 * "more" bar goes away, and that must not stop the view from following.
 */
export const usePager = (viewportRef: RefObject<HTMLElement | null>): Pager => {
  const [progress, setProgress] = useState<number | null>(null);
  const anchorRef = useRef<Element | null>(null);
  const modeRef = useRef<Mode>('page');
  /** Set by a wheel or swipe, cleared whenever the view is placed from code. */
  const userRef = useRef(false);

  const measure = (element: HTMLElement): void => {
    const { scrollTop, clientHeight, scrollHeight } = element;
    setProgress(
      restBelow(element) > TOLERANCE
        ? Math.round(((scrollTop + clientHeight) / scrollHeight) * 100)
        : null,
    );
  };

  const scrollTo = (element: HTMLElement, top: number): void => {
    userRef.current = false;
    element.scrollTop = top;
    measure(element);
  };

  /** Puts the view where the current mode says. */
  const place = (element: HTMLElement): void => {
    const echoes = element.querySelectorAll('[data-echo]');
    const anchor = echoes[echoes.length - 1] ?? null;
    if (anchor !== anchorRef.current) {
      anchorRef.current = anchor;
      modeRef.current = 'page';
    }

    const end = element.scrollHeight - element.clientHeight;
    switch (modeRef.current) {
      case 'page': {
        const pageStart =
          anchor instanceof HTMLElement
            ? anchor.offsetTop - px(getComputedStyle(element).paddingTop)
            : 0;
        scrollTo(element, Math.max(0, Math.min(end, pageStart)));
        break;
      }
      case 'end':
        scrollTo(element, end);
        break;
      case 'free':
        measure(element);
        break;
    }
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
    const line = px(style.lineHeight);
    // Bottom padding only shows at the very end, so mid-page the text runs to the edge.
    const page = element.clientHeight - px(style.paddingTop) - line;
    scrollTo(element, element.scrollTop + Math.max(page, line));
    // On the last page, keep up with whatever is still being printed.
    modeRef.current = restBelow(element) > TOLERANCE ? 'free' : 'end';
  };

  const onScroll = (): void => {
    const element = viewportRef.current;
    if (!element) return;
    // The reader scrolled: stay put, or follow new output if they came back to the end.
    if (userRef.current) modeRef.current = restBelow(element) > TOLERANCE ? 'free' : 'end';
    measure(element);
  };

  const onUserScroll = (): void => {
    userRef.current = true;
  };

  return { progress, next, onScroll, onUserScroll };
};
