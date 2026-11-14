/**
 * Reports page views and commands to the visit counter in `stats/`.
 *
 * Only in the production build, and only when `VITE_STATS_URL` is set. A
 * keepalive fetch with a plain-text body needs no CORS preflight, never delays
 * the page and survives the tab closing. The only thing kept in the browser is
 * the owner's own "don't count me" mark.
 */
const ENDPOINT = import.meta.env.PROD ? import.meta.env.VITE_STATS_URL : undefined;

/** `?me` marks this browser as the owner's, `?me=off` clears the mark. */
const OWNER_PARAM = 'me';
const OWNER_KEY = 'bash-me-up:owner';

type EventType = 'view' | 'command';

let owner = false;

/** Reads and applies `?me`, then takes it out of the address bar. */
const readOwnerMark = (): void => {
  try {
    const url = new URL(location.href);
    const mark = url.searchParams.get(OWNER_PARAM);
    if (mark !== null) {
      if (mark === 'off') localStorage.removeItem(OWNER_KEY);
      else localStorage.setItem(OWNER_KEY, '1');
      url.searchParams.delete(OWNER_PARAM);
      history.replaceState(history.state, '', url);
    }
    owner = localStorage.getItem(OWNER_KEY) === '1';
  } catch {
    // Storage blocked: count the visit like any other.
  }
};

export const track = (type: EventType, name: string): void => {
  if (!ENDPOINT || owner) return;
  try {
    const body = JSON.stringify({
      type,
      name,
      referrer: document.referrer,
      lang: navigator.language,
      screen: `${screen.width}x${screen.height}`,
    });
    void fetch(`${ENDPOINT.replace(/\/$/, '')}/api/terminal`, {
      method: 'POST',
      body,
      keepalive: true,
      mode: 'no-cors',
      credentials: 'omit',
    }).catch(() => undefined);
  } catch {
    // Counting visits must never break the site.
  }
};

/** The landing: the path, plus the command a `?run=` link types for the visitor. */
export const trackView = (): void => {
  readOwnerMark();
  const run = new URLSearchParams(location.search).get('run')?.trim().split(/\s+/)[0];
  track('view', run ? `?run=${run}` : '/');
};
