/**
 * Reports page views and commands to the visit counter in `stats/`.
 *
 * Only in the production build, and only when `VITE_STATS_URL` is set. A
 * beacon with a plain-text body needs no CORS preflight, never delays the
 * page and survives the tab closing. Nothing is stored in the browser.
 */
const ENDPOINT = import.meta.env.PROD ? import.meta.env.VITE_STATS_URL : undefined;

type EventType = 'view' | 'command';

export const track = (type: EventType, name: string): void => {
  if (!ENDPOINT) return;
  try {
    const body = JSON.stringify({
      type,
      name,
      referrer: document.referrer,
      lang: navigator.language,
      screen: `${screen.width}x${screen.height}`,
    });
    const url = `${ENDPOINT.replace(/\/$/, '')}/event`;
    if (!navigator.sendBeacon?.(url, body)) {
      void fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(
        () => undefined,
      );
    }
  } catch {
    // Counting visits must never break the site.
  }
};

/** The landing: the path, plus the command a `?run=` link types for the visitor. */
export const trackView = (): void => {
  const run = new URLSearchParams(location.search).get('run')?.trim().split(/\s+/)[0];
  track('view', run ? `?run=${run}` : '/');
};
