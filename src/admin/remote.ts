/**
 * Sends the terminal's root commands to the admin API. The commands only
 * describe a request (`remote` effect); this is the one place that does I/O.
 */
import type { RemoteFailure, RemoteReply, RemoteRequest } from '../terminal/commands/admin/remote';
import type { Session } from '../../stats/src/types';
import { HttpError, SignedOut, api, login } from './api';

/**
 * The terminal's sign-in lives in memory, never in the browser's storage:
 * a reload or `reboot` forgets it, and `sudo` asks for the password again.
 * Nor does the terminal pick up the admin page's sign-in.
 */
let session: Session | null = null;

export const isRoot = (): boolean => session !== null && session.expires > Date.now();

export const forgetRoot = (): void => {
  session = null;
};

const TYPES = { all: '', views: 'view', commands: 'command' } as const;

const failure = (reason: unknown): RemoteFailure => {
  if (reason instanceof SignedOut) return 'signed-out';
  if (reason instanceof HttpError) return reason.status === 404 ? 'not-found' : 'failed';
  // fetch rejects with a TypeError when offline, a DOMException on timeout.
  return 'offline';
};

export async function perform(request: RemoteRequest): Promise<RemoteReply> {
  if (request.kind === 'login') {
    const result = await login(request.password, false);
    if (typeof result === 'string') return { ok: false, failure: result };
    session = result;
    return { ok: true, data: null };
  }

  if (!session || !isRoot()) {
    forgetRoot();
    return { ok: false, failure: 'signed-out' };
  }
  try {
    switch (request.kind) {
      case 'stats':
      case 'top':
        return { ok: true, data: await api.overview(session, request.days) };
      case 'visits':
        return { ok: true, data: await api.events(session, TYPES[request.filter]) };
      case 'visitor':
        return { ok: true, data: await api.visitor(session, request.id) };
      case 'db':
        return { ok: true, data: await api.health(session) };
      case 'export':
        return { ok: true, data: await api.exportCsv(session, request.days) };
    }
  } catch (reason) {
    if (reason instanceof SignedOut) forgetRoot();
    return { ok: false, failure: failure(reason) };
  }
}
