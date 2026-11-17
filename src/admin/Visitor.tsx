import { useEffect } from 'react';
import type { ViewProps } from './Admin';
import { api } from './api';
import { EventList } from './Feed';
import { formatDateTime, formatNumber, place } from './format';
import { useLoad } from './useLoad';
import styles from './Admin.module.css';

/** Everything one visitor did, in a panel over the page. */
export function VisitorPanel({
  session,
  onSignedOut,
  id,
  onClose,
}: ViewProps & { id: string; onClose: () => void }) {
  const { data, at, error } = useLoad(() => api.visitor(session, id), id, onSignedOut);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  const latest = data?.events.find((event) => event.type === 'view') ?? data?.events[0];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <aside
        className={styles.panel}
        role="dialog"
        aria-label={`Посетитель ${id}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.cardHead}>
          <h2>Посетитель #{id.slice(0, 6)}</h2>
          <button type="button" className={styles.ghost} onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {data && (
          <>
            <dl className={styles.facts}>
              <dt>впервые</dt>
              <dd>{formatDateTime(data.first)}</dd>
              <dt>последний раз</dt>
              <dd>{formatDateTime(data.last)}</dd>
              <dt>дней с визитами</dt>
              <dd>{formatNumber(data.days)}</dd>
              <dt>просмотров / команд</dt>
              <dd>
                {formatNumber(data.views)} / {formatNumber(data.commands)}
              </dd>
              {latest && (
                <>
                  <dt>откуда</dt>
                  <dd>
                    {place(latest)}
                    {latest.network && ` · ${latest.network}`}
                  </dd>
                  <dt>устройство</dt>
                  <dd>
                    {[latest.device, latest.os, latest.browser, latest.screen, latest.lang]
                      .filter(Boolean)
                      .join(' · ')}
                  </dd>
                </>
              )}
            </dl>
            <EventList events={data.events} now={at} />
          </>
        )}
      </aside>
    </div>
  );
}
