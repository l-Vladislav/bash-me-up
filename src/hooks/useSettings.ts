import { useEffect, useState } from 'react';
import { parseSettings } from '../terminal/settings';
import type { Settings } from '../terminal/settings';

const STORAGE_KEY = 'bash-me-up:settings';

const load = (): Settings => {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Storage can be blocked (private mode, embedded frames); defaults still work.
    return parseSettings(null);
  }
};

export type UpdateSettings = (patch: Partial<Settings>) => void;

/** Display settings, persisted across visits and mirrored onto `<html>` for CSS. */
export const useSettings = (): [Settings, UpdateSettings] => {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    document.documentElement.dataset.phosphor = settings.phosphor;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Nothing to do: the setting simply will not persist.
    }
  }, [settings]);

  const update: UpdateSettings = (patch) => setSettings((current) => ({ ...current, ...patch }));

  return [settings, update];
};
