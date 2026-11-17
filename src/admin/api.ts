/**
 * The admin API of the Worker in `stats/`, and the sign-in kept in this browser.
 */
import type { Feed, Health, Overview, Session, VisitorStory } from '../../stats/src/types';
import { OWNER_KEY } from '../visits';

export const API = import.meta.env.VITE_STATS_URL?.replace(/\/$/, '');

const SESSION_KEY = 'bash-me-up:admin';

export class SignedOut extends Error {}

/** The API answered with an error status. */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Ошибка ${status}`);
    this.status = status;
  }
}

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

/** Why a sign-in failed. */
export type LoginFailure = 'wrong' | 'throttled' | 'offline' | 'unconfigured' | 'failed';

const TIMEOUT = 15_000;

/**
 * Trades the password for a token and keeps it in this browser, which from
 * then on is the owner's: its visits to the site stop counting.
 */
export async function login(password: string): Promise<Session | LoginFailure> {
  if (!API) return 'unconfigured';
  const response = await fetch(`${API}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(TIMEOUT),
  }).catch(() => null);
  if (!response) return 'offline';
  if (response.status === 401) return 'wrong';
  if (response.status === 429) return 'throttled';
  if (!response.ok) return 'failed';
  const session = (await response.json()) as Session;
  saveSession(session);
  setOwner(true);
  return session;
}

const FAILURES: Record<LoginFailure, string> = {
  wrong: 'Неверный пароль',
  throttled: 'Слишком много попыток, подождите минуту',
  offline: 'Сервер не отвечает',
  unconfigured: 'VITE_STATS_URL не задан',
  failed: 'Сервер ответил ошибкой',
};

/** `login` for the admin page: throws a message fit to show. */
export async function signIn(password: string): Promise<Session> {
  const result = await login(password);
  if (typeof result === 'string') throw new Error(FAILURES[result]);
  return result;
}

async function get(session: Session, path: string): Promise<Response> {
  const response = await fetch(`${API}/api/admin/${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (response.status === 401) {
    saveSession(null);
    throw new SignedOut();
  }
  if (!response.ok) throw new HttpError(response.status);
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
  /** Downloads the period's events as a CSV file; returns its name. */
  async exportCsv(session: Session, days: number): Promise<string> {
    const response = await get(session, `export?days=${days}`);
    const name =
      /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ??
      'visits.csv';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return name;
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
