import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react';
import { PROMPT } from '../hooks/useTerminal';
import type { Shell } from '../hooks/useTerminal';
import { OutputLine } from './OutputLine';
import { Prompt } from './Prompt';
import styles from './Terminal.module.css';

const hasSelection = (): boolean => (window.getSelection()?.toString() ?? '') !== '';

export function Terminal({ entries, busy, history, run, skip }: Shell) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest output in view, like paper feeding out of a teletype.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [entries, busy]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  // Any key skips a printout in progress; otherwise typing anywhere lands in the prompt.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) {
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
    <div ref={scrollRef} className={styles.terminal} onClick={handleClick}>
      <div role="log" aria-live="polite">
        {entries.map((entry) => (
          <OutputLine key={entry.id} line={entry.line} onCommand={run} />
        ))}
      </div>
      {!busy && <Prompt label={PROMPT} history={history} inputRef={inputRef} onSubmit={run} />}
    </div>
  );
}
