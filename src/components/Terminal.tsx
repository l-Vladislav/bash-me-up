import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { PROMPT } from '../hooks/useTerminal';
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

const scrollToEnd = (element: HTMLElement | null): void => {
  if (element) element.scrollTop = element.scrollHeight;
};

const ignoreCommand = (): void => undefined;

export function Terminal({ shell, disabled = false }: TerminalProps) {
  const { screen, busy, history, run, skip } = shell;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest output in view, like paper feeding out of a teletype.
  useLayoutEffect(() => {
    scrollToEnd(scrollRef.current);
  }, [screen.entries, busy]);

  useEffect(() => {
    if (!busy && !disabled) inputRef.current?.focus({ preventScroll: true });
  }, [busy, disabled]);

  // Any key skips a printout in progress; otherwise typing anywhere lands in the prompt.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (disabled || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('button, a, [role="slider"]')) {
      return;
    }
    if (busy) {
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

  const handleClick = (): void => {
    if (busy) skip();
    else if (!hasSelection()) inputRef.current?.focus({ preventScroll: true });
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

      <div ref={scrollRef} className={styles.viewport} onClick={handleClick}>
        <div role="log" aria-live="polite">
          {screen.entries.map((entry) => (
            <OutputLine key={entry.id} line={entry.line} onCommand={run} />
          ))}
        </div>
        {!busy && <Prompt label={PROMPT} history={history} inputRef={inputRef} onSubmit={run} />}
      </div>
    </div>
  );
}
