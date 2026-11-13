import { useEffect } from 'react';

/** The keyboard is assumed open once it covers more than this share of the window. */
const KEYBOARD_THRESHOLD = 0.75;

/**
 * Mirrors the visible part of the window onto `<html>`: its height as
 * `--viewport-height`, and `data-keyboard` while an on-screen keyboard covers
 * the page. iOS Safari overlays the keyboard instead of shrinking the layout,
 * so without this the prompt would end up hidden underneath it.
 */
export const useVisualViewport = (): void => {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    const update = (): void => {
      root.style.setProperty('--viewport-height', `${Math.round(viewport.height)}px`);
      root.toggleAttribute('data-keyboard', viewport.height < innerHeight * KEYBOARD_THRESHOLD);
      // iOS scrolls the page to bring a focused input into view; the layout already does.
      if (scrollY !== 0) scrollTo(0, 0);
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--viewport-height');
      root.removeAttribute('data-keyboard');
    };
  }, []);
};
