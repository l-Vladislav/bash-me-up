import { useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { complete } from '../terminal/completion';
import styles from './Terminal.module.css';

interface PromptProps {
  label: string;
  history: readonly string[];
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (input: string) => void;
}

/**
 * The command line. A real (invisible) `<input>` owns focus, IME and mobile
 * keyboards; what the visitor sees is a mirror of its value with a block cursor.
 */
export function Prompt({ label, history, inputRef, onSubmit }: PromptProps) {
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
    const withControl = event.ctrlKey || event.metaKey;

    if (event.key === 'Enter') {
      onSubmit(value);
      setRecalled(null);
      replaceValue('');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      replaceValue(complete(value));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      recall(-1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      recall(1);
    } else if (withControl && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      onSubmit('clear');
    } else if (event.ctrlKey && event.key.toLowerCase() === 'c' && value !== '') {
      event.preventDefault();
      replaceValue('');
    }
  };

  return (
    <label className={styles.prompt}>
      <span className={styles.dim}>{label} </span>
      <span>
        {value.slice(0, caret)}
        <span className={styles.cursor}>{value.charAt(caret) || ' '}</span>
        {value.slice(caret + 1)}
      </span>
      <input
        ref={inputRef}
        className={styles.input}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setCaret(event.target.selectionStart ?? event.target.value.length);
        }}
        onSelect={(event) => setCaret(event.currentTarget.selectionStart ?? value.length)}
        onKeyDown={handleKeyDown}
        aria-label="Terminal command"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
    </label>
  );
}
