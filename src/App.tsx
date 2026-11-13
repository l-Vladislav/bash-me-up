import { useState } from 'react';
import { Monitor } from './components/Monitor';
import { QuickKeys } from './components/QuickKeys';
import { Terminal } from './components/Terminal';
import { terminal } from './content/resume';
import { useSettings } from './hooks/useSettings';
import { useTerminal } from './hooks/useTerminal';
import { useVisualViewport } from './hooks/useVisualViewport';

export function App() {
  const [settings, updateSettings] = useSettings();
  const [powered, setPowered] = useState(true);
  const shell = useTerminal(settings, updateSettings);
  useVisualViewport();

  const handlePowerChange = (on: boolean): void => {
    // Switching back on is a cold start: the terminal boots from scratch.
    if (on) shell.reboot();
    setPowered(on);
  };

  return (
    <Monitor
      model={terminal.model}
      settings={settings}
      onSettingsChange={updateSettings}
      powered={powered}
      onPowerChange={handlePowerChange}
      panel={<QuickKeys commands={terminal.quickKeys} disabled={!powered} onRun={shell.click} />}
    >
      <Terminal shell={shell} disabled={!powered} />
    </Monitor>
  );
}
