import styles from './QuickKeys.module.css';

interface QuickKeysProps {
  commands: readonly string[];
  onRun: (command: string) => void;
}

/** Physical-looking keys on the monitor's front panel, for visitors who would rather not type. */
export function QuickKeys({ commands, onRun }: QuickKeysProps) {
  return (
    <nav className={styles.keys} aria-label="Quick commands">
      {commands.map((command) => (
        <button key={command} type="button" className={styles.key} onClick={() => onRun(command)}>
          {command}
        </button>
      ))}
    </nav>
  );
}
