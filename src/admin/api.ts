/**
 * The admin API of the Worker in `stats/`, and the sign-in kept in this browser.
 */
import type { Feed, Health, Overview, Session, VisitorStory } from '../../stats/src/types';
import { OWNER_KEY } from '../visits';

export const API = import.meta.env.VITE_STATS_URL?.replace(/\/$/, '');

const SESSION_KEY = 'bash-me-up:admin';

export class SignedOut extends Error {}

export const loadSession = (): Session | null => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
    return session && session.expires > Date.now() ? session : null;
  } catch {
    return null;
  }
};

const saveSession = (session: Session | null): void => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the sign-in lasts as long as the tab.
  }
};

export const signOut = (): void => saveSession(null);

/** Trades the password for a token. Throws a message fit to show. */
export async function signIn(password: string): Promise<Session> {
  if (!API) throw new Error('VITE_STATS_URL не задан');
  const response = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }).catch(() => null);
  if (!response) throw new Error('Сервер не отвечает');
  if (response.status === 401) throw new Error('Неверный пароль');
  if (response.status === 429) throw new Error('Слишком много попыток, подождите минуту');
  if (!response.ok) throw new Error(`Ошибка ${response.status}`);
  const session = (await response.json()) as Session;
  saveSession(session);
  // The owner's own visits to the site should not count.
  setOwner(true);
  return session;
}

async function get(session: Session, path: string): Promise<Response> {
  const response = await fetch(`${API}/api/admin/${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (response.status === 401) {
    saveSession(null);
    throw new SignedOut();
  }
  if (!response.ok) throw new Error(`Ошибка ${response.status}`);
  return response;
}

const getJson = async <T>(session: Session, path: string): Promise<T> =>
  (await get(session, path)).json() as Promise<T>;

export const api = {
  overview: (session: Session, days: number) => getJson<Overview>(session, `overview?days=${days}`),
  events: (session: Session, type: string, before?: number) =>
    getJson<Feed>(
      session,
      `events?${new URLSearchParams({ ...(type && { type }), ...(before && { before: String(before) }) })}`,
    ),
  visitor: (session: Session, id: string) =>
    getJson<VisitorStory>(session, `visitor?id=${encodeURIComponent(id)}`),
  health: (session: Session) => getJson<Health>(session, 'health'),
  /** Downloads the period's events as a CSV file. */
  async exportCsv(session: Session, days: number): Promise<void> {
    const response = await get(session, `export?days=${days}`);
    const name =
      /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ??
      'visits.csv';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  },
};

/* ---- "Don't count me" ----------------------------------------------------- */

export const isOwner = (): boolean => {
  try {
    return localStorage.getItem(OWNER_KEY) === '1';
  } catch {
    return false;
  }
};

export const setOwner = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(OWNER_KEY, '1');
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked: nothing to remember it in.
  }
};
