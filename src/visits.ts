/**
 * Reports page views and commands to the visit counter in `stats/`.
 *
 * Only in the production build, and only when `VITE_STATS_URL` is set. A
 * keepalive fetch with a plain-text body needs no CORS preflight, never delays
 * the page and survives the tab closing. The browser keeps a random visitor ID,
 * so a person who comes back on another day is still one visitor, and the
 * owner's own "don't count me" mark.
 */
const ENDPOINT = import.meta.env.PROD ? import.meta.env.VITE_STATS_URL : undefined;

/** `?me` marks this browser as the owner's, `?me=off` clears the mark. */
const OWNER_PARAM = 'me';
/** Shared with the admin page, which sets it on sign-in. */
export const OWNER_KEY = 'bash-me-up:owner';
const VISITOR_KEY = 'bash-me-up:visitor';

type EventType = 'view' | 'command';

let visitor: string | undefined;

/** The random ID this browser was given on its first visit, made now if there is none. */
const readVisitor = (): string | undefined => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: the Worker falls back to its daily hash.
    return undefined;
  }
};

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
  } catch {
    // Storage blocked: count the visit like any other.
  }
};

/** Read on every event: signing in from the terminal or `countme` changes it mid-visit. */
const isOwner = (): boolean => {
  try {
    return localStorage.getItem(OWNER_KEY) === '1';
  } catch {
    // Storage blocked: count the visit like any other.
    return false;
  }
};

export const track = (type: EventType, name: string): void => {
  if (!ENDPOINT || isOwner()) return;
  try {
    const body = JSON.stringify({
      type,
      name,
      vid: visitor,
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
  visitor = readVisitor();
  const run = new URLSearchParams(location.search).get('run')?.trim().split(/\s+/)[0];
  track('view', run ? `?run=${run}` : '/');
};
