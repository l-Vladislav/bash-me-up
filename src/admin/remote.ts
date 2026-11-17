/**
 * Sends the terminal's root commands to the admin API. The commands only
 * describe a request (`remote` effect); this is the one place that does I/O.
 */
import type { RemoteFailure, RemoteReply, RemoteRequest } from '../terminal/commands/admin/remote';
import { HttpError, SignedOut, api, loadSession, login } from './api';

const TYPES = { all: '', views: 'view', commands: 'command' } as const;

const failure = (reason: unknown): RemoteFailure => {
  if (reason instanceof SignedOut) return 'signed-out';
  if (reason instanceof HttpError) return reason.status === 404 ? 'not-found' : 'failed';
  // fetch rejects with a TypeError when offline, a DOMException on timeout.
  return 'offline';
};

export async function perform(request: RemoteRequest): Promise<RemoteReply> {
  if (request.kind === 'login') {
    const result = await login(request.password);
    return typeof result === 'string' ? { ok: false, failure: result } : { ok: true, data: null };
  }

  const session = loadSession();
  if (!session) return { ok: false, failure: 'signed-out' };
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
    return { ok: false, failure: failure(reason) };
  }
}
