import styles from './QuickKeys.module.css';

interface QuickKeysProps {
  commands: readonly string[];
  disabled?: boolean;
  onRun: (command: string) => void;
}

/** Physical-looking keys on the monitor's front panel, for visitors who would rather not type. */
export function QuickKeys({ commands, disabled = false, onRun }: QuickKeysProps) {
  return (
    <nav className={styles.keys} aria-label="Quick commands">
      {commands.map((command) => (
        <button
          key={command}
          type="button"
          className={styles.key}
          disabled={disabled}
          onClick={() => onRun(command)}
        >
          {command}
        </button>
      ))}
    </nav>
  );
}
