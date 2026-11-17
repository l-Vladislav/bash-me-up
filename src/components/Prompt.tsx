import { useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { play } from '../audio/sound';
import { complete } from '../terminal/completion';
import styles from './Terminal.module.css';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'AltGraph']);

const hasSelection = (): boolean => (window.getSelection()?.toString() ?? '') !== '';

interface PromptProps {
  label: string;
  /** Output is still printing: the line is hidden and ignores input, but keeps focus. */
  waiting: boolean;
  history: readonly string[];
  /** Tab completes shell commands; off while a program owns the prompt. */
  completion: boolean;
  /** A password: what is typed stays invisible, as in a real terminal. */
  secret?: boolean;
  /** Signed in as the admin: completion offers the root commands too. */
  root?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (input: string) => void;
  onInterrupt: (typed: string) => void;
  onClear: () => void;
}

/**
 * The command line. A real (invisible) `<input>` owns focus, IME and mobile
 * keyboards; what the visitor sees is a mirror of its value with a block cursor.
 */
export function Prompt({
  label,
  waiting,
  history,
  completion,
  secret = false,
  root = false,
  inputRef,
  onSubmit,
  onInterrupt,
  onClear,
}: PromptProps) {
  const [value, setValue] = useState('');
  const [caret, setCaret] = useState(0);
  /** Index into `history` while recalling; `null` when typing a fresh line. */
  const [recalled, setRecalled] = useState<number | null>(null);

  const replaceValue = (next: string): void => {
    setValue(next);
    setCaret(next.length);
  };

  const recall = (step: -1 | 1): void => {
    const index = (recalled ?? history.length) + step;
    if (index < 0) return;

    const entry = history[index];
    setRecalled(entry === undefined ? null : index);
    replaceValue(entry ?? '');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Every key clicks, even while output prints; Shift and Ctrl alone do not, as on a VT220.
    if (!MODIFIERS.has(event.key) && !event.repeat) play(event.key === 'Enter' ? 'enter' : 'key');
    if (waiting) {
      event.preventDefault();
      return;
    }
    const withControl = event.ctrlKey || event.metaKey;

    if (event.key === 'Enter') {
      onSubmit(value);
      setRecalled(null);
      replaceValue('');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const completed = completion ? complete(value, root) : value;
      // Nothing to add: the shell rings the bell, as bash does.
      if (completed === value) play('bell');
      else replaceValue(completed);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      recall(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      recall(1);
    } else if (withControl && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      onClear();
    } else if (event.ctrlKey && event.key.toLowerCase() === 'c' && !hasSelection()) {
      // Ctrl+C copies when text is selected; otherwise it interrupts, as in a real shell.
      event.preventDefault();
      onInterrupt(value);
      setRecalled(null);
      replaceValue('');
    }
  };

  return (
    <label className={waiting ? `${styles.prompt} ${styles.waiting}` : styles.prompt}>
      <span className={styles.dim}>{label} </span>
      {secret ? (
        <span className={styles.cursor}> </span>
      ) : (
        <span>
          {value.slice(0, caret)}
          <span className={styles.cursor}>{value.charAt(caret) || ' '}</span>
          {value.slice(caret + 1)}
        </span>
      )}
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(event) => {
          if (waiting) return;
          setValue(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={handleKeyDown}
        type={secret ? 'password' : 'text'}
        aria-label={secret ? 'Password' : 'Terminal command'}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
    </label>
  );
}
