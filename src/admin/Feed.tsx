import { useState } from 'react';
import type { Feed, VisitEvent } from '../../stats/src/types';
import type { ViewProps } from './Admin';
import { SignedOut, api } from './api';
import { formatDateTime, formatWhen, place } from './format';
import { useLoad } from './useLoad';
import styles from './Admin.module.css';

const FILTERS = [
  ['', 'всё'],
  ['view', 'заходы'],
  ['command', 'команды'],
] as const;

const REFRESH = 30_000;

export function FeedView({ session, onSignedOut, onVisitor }: ViewProps) {
  const [type, setType] = useState('');
  const [live, setLive] = useState(true);
  const first = useLoad(() => api.events(session, type), type, onSignedOut, live ? REFRESH : 0);
  // Older pages, appended by "показать ещё", belong to the first page they followed.
  const [older, setOlder] = useState<{ after?: Feed; events: VisitEvent[]; next: number | null }>({
    events: [],
    next: null,
  });
  const [busy, setBusy] = useState(false);
  const current = older.after && older.after === first.data ? older : undefined;
  const next = current ? current.next : (first.data?.next ?? null);

  const more = async () => {
    if (!next) return;
    setBusy(true);
    try {
      const page = await api.events(session, type, next);
      setOlder({
        after: first.data,
        events: [...(current?.events ?? []), ...page.events],
        next: page.next,
      });
    } catch (reason) {
      if (reason instanceof SignedOut) onSignedOut();
    } finally {
      setBusy(false);
    }
  };

  const events = [...(first.data?.events ?? []), ...(current?.events ?? [])];

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Что показывать">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={value === type}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          обновлять сам
        </label>
        <button
          type="button"
          className={styles.ghost}
          onClick={first.reload}
          disabled={first.loading}
        >
          {first.loading ? 'обновляю…' : '↻ обновить'}
        </button>
      </div>
      {first.error && <p className={styles.error}>{first.error}</p>}
      <EventList events={events} now={first.at} onVisitor={onVisitor} />
      {first.data && events.length === 0 && <p className={styles.empty}>пока пусто</p>}
      {next && (
        <button type="button" className={styles.button} onClick={more} disabled={busy}>
          {busy ? 'загружаю…' : 'показать ещё'}
        </button>
      )}
    </>
  );
}

export function EventList({
  events,
  now,
  onVisitor,
}: {
  events: VisitEvent[];
  /** What "5 мин" counts from: when the events were loaded. */
  now: number;
  onVisitor?: (id: string) => void;
}) {
  return (
    <ol className={styles.feed}>
      {events.map((event) => (
        <li key={event.id} className={event.type === 'command' ? styles.command : styles.view}>
          <time dateTime={new Date(event.at).toISOString()} title={formatDateTime(event.at)}>
            {formatWhen(event.at, now)}
          </time>
          <span className={styles.what}>
            {event.type === 'command' ? `$ ${event.name}` : `→ ${event.name}`}
          </span>
          <span className={styles.where}>
            {place(event)}
            {event.type === 'view' && (
              <>
                {' · '}
                {event.referrer ?? 'напрямую'}
                {' · '}
                {[event.device, event.os, event.browser].filter(Boolean).join(' ')}
                {event.network && <span className={styles.dim}> · {event.network}</span>}
              </>
            )}
          </span>
          {onVisitor && (
            <button
              type="button"
              className={styles.who}
              onClick={() => onVisitor(event.visitor)}
              title="Всё, что делал этот посетитель"
            >
              #{event.visitor.slice(0, 6)}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
