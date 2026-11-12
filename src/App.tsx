import { Monitor } from './components/Monitor';
import { QuickKeys } from './components/QuickKeys';
import { Terminal } from './components/Terminal';
import { terminal } from './content/resume';
import { useSettings } from './hooks/useSettings';
import { useTerminal } from './hooks/useTerminal';

export function App() {
  const [settings, updateSettings] = useSettings();
  const shell = useTerminal(settings, updateSettings);

  return (
    <Monitor
      crt={settings.crt}
      model={terminal.model}
      panel={<QuickKeys commands={terminal.quickKeys} onRun={shell.run} />}
    >
      <Terminal {...shell} />
    </Monitor>
  );
}
