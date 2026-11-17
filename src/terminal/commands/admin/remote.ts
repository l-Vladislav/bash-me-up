/**
 * What the root commands ask the admin API (`stats/`), and what comes back.
 * Commands only describe the request, as a `remote` effect; the shell sends
 * it (`src/admin/remote.ts`) and prints `present(request, reply)`.
 */
import type { TopKey } from '../../../../stats/src/types';

export type VisitFilter = 'all' | 'views' | 'commands';

export type RemoteRequest =
  | { kind: 'login'; password: string; attempt: number }
  | { kind: 'stats'; days: number }
  | { kind: 'top'; list: TopKey; days: number }
  | { kind: 'visits'; filter: VisitFilter }
  | { kind: 'visitor'; id: string }
  | { kind: 'db' }
  | { kind: 'export'; days: number };

export type RemoteFailure =
  /** Wrong password. */
  | 'wrong'
  /** Too many sign-in attempts from this address. */
  | 'throttled'
  | 'offline'
  /** The build has no `VITE_STATS_URL`. */
  | 'unconfigured'
  /** The sign-in expired or the password changed. */
  | 'signed-out'
  | 'not-found'
  | 'failed';

export type RemoteReply = { ok: true; data: unknown } | { ok: false; failure: RemoteFailure };
