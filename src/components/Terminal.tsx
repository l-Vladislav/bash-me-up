import { useEffect, useEffectEvent, useRef } from 'react';
import type { MouseEvent } from 'react';
import { COARSE_POINTER_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { usePager } from '../hooks/usePager';
import type { Shell } from '../hooks/useTerminal';
import { OutputLine } from './OutputLine';
import { Prompt } from './Prompt';
import styles from './Terminal.module.css';

interface TerminalProps {
  shell: Shell;
  /** Ignores all input, e.g. while the monitor is switched off. */
  disabled?: boolean;
}

const hasSelection = (): boolean => (window.getSelection()?.toString() ?? '') !== '';

/** Links, command buttons and clickable table rows in the output. */
const isControl = (target: EventTarget): boolean =>
  target instanceof Element && target.closest('button, a, [data-command]') !== null;

const scrollToEnd = (element: HTMLElement | null): void => {
  if (element) element.scrollTop = element.scrollHeight;
};

const ignoreCommand = (): void => undefined;

export function Terminal({ shell, disabled = false }: TerminalProps) {
  const { screen, busy, history, prompt, interactive, run, click, interrupt, clear, skip } = shell;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // On a touchscreen focus means a keyboard covering half the screen: wait for a tap.
  const touch = useMediaQuery(COARSE_POINTER_QUERY);

  // New output feeds up like paper from a teletype, a screenful at a time.
  const pager = usePager(scrollRef);
  const paging = pager.progress !== null;

  useEffect(() => {
    if (!busy && !disabled && !touch) inputRef.current?.focus({ preventScroll: true });
  }, [busy, disabled, touch]);

  // Any key skips a printout in progress; otherwise typing anywhere lands in the prompt.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('button, a, [role="slider"]')) {
      return;
    }
    if (event.key === 'PageDown' && paging) {
      event.preventDefault();
      pager.next();
    } else if (busy) {
      skip();
    } else if (event.key.length === 1) {
      inputRef.current?.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent): void => handleKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (busy) skip();
    // A tap on a link or command is not a wish to type: on a phone, focusing
    // the prompt here would pop up the keyboard over the page it opens.
    else if (!isControl(event.target) && !hasSelection()) {
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  // Enter on an empty line turns the page, as in `more`; anything typed runs as usual.
  const handleSubmit = (input: string): void => {
    if (paging && input.trim() === '') pager.next();
    else run(input);
  };

  return (
    <div className={styles.terminal}>
      {/* Phosphor persistence: the picture that was just wiped fades out behind the new one. */}
      {screen.wipes > 0 && (
        <div
          key={screen.wipes}
          ref={scrollToEnd}
          className={`${styles.viewport} ${styles.ghost}`}
          aria-hidden="true"
          inert
        >
          {screen.ghost.map((entry) => (
            <OutputLine key={entry.id} line={entry.line} onCommand={ignoreCommand} />
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className={paging ? `${styles.viewport} ${styles.paging}` : styles.viewport}
        onClick={handleClick}
        onScroll={pager.onScroll}
        onWheel={pager.onUserScroll}
        onTouchMove={pager.onUserScroll}
      >
        <div role="log" aria-live="polite">
          {screen.entries.map((entry) => (
            <OutputLine key={entry.id} line={entry.line} onCommand={click} />
          ))}
        </div>
        {/* Hidden rather than removed while busy, so a phone keeps its keyboard up. */}
        <Prompt
          label={prompt}
          waiting={busy}
          history={interactive ? [] : history}
          completion={!interactive}
          inputRef={inputRef}
          onSubmit={handleSubmit}
          onInterrupt={interrupt}
          onClear={clear}
        />
      </div>

      {paging && (
        <button type="button" className={styles.more} onClick={pager.next}>
          <span className={styles.moreLabel}>-- MORE ({pager.progress}%) --</span>
          <span className={styles.moreAction}>next ▸</span>
        </button>
      )}
    </div>
  );
}
