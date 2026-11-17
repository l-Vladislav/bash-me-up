import { useState } from 'react';
import type { ViewProps } from './Admin';
import { API, SignedOut, api, isOwner, setOwner } from './api';
import { formatBytes, formatDateTime, formatNumber } from './format';
import { useLoad } from './useLoad';
import styles from './Admin.module.css';

const REPO = 'https://github.com/l-Vladislav/bash-me-up';

const EXPORT_PERIODS = [
  [7, '7 дней'],
  [30, '30 дней'],
  [90, '90 дней'],
  [365, 'год'],
] as const;

export function ToolsView({ session, onSignedOut }: ViewProps) {
  return (
    <div className={styles.grid}>
      <OwnerCard />
      <ExportCard session={session} onSignedOut={onSignedOut} />
      <HealthCard session={session} onSignedOut={onSignedOut} />
      <section className={styles.card}>
        <h2>Ссылки</h2>
        <ul className={styles.links}>
          <li>
            <a href={import.meta.env.BASE_URL}>сайт</a>
          </li>
          <li>
            <a href={`${REPO}/actions`} target="_blank" rel="noreferrer">
              сборки и деплой (GitHub Actions)
            </a>
          </li>
          <li>
            <a href={REPO} target="_blank" rel="noreferrer">
              репозиторий
            </a>
          </li>
          <li>
            <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer">
              Cloudflare (воркер и база)
            </a>
          </li>
        </ul>
      </section>
      <section className={styles.card}>
        <h2>Сессия</h2>
        <p>
          Вход действует до {formatDateTime(session.expires)}. Новый пароль (
          <code>wrangler secret put PASSWORD</code>) выводит из всех браузеров сразу.
        </p>
        <p className={styles.dim}>API: {API}</p>
      </section>
    </div>
  );
}

function OwnerCard() {
  const [owner, setOwnerState] = useState(isOwner);
  const toggle = () => {
    setOwner(!owner);
    setOwnerState(!owner);
  };
  return (
    <section className={styles.card}>
      <h2>Этот браузер</h2>
      <p>
        {owner
          ? 'Ваши заходы на сайт с этого браузера не считаются.'
          : 'Заходы с этого браузера считаются, как у всех.'}
      </p>
      <button type="button" className={styles.button} onClick={toggle}>
        {owner ? 'снова считать меня' : 'не считать меня'}
      </button>
      <p className={styles.dim}>
        На другом устройстве: откройте сайт с <code>?me</code> или войдите в админку.
      </p>
    </section>
  );
}

function ExportCard({ session, onSignedOut }: Pick<ViewProps, 'session' | 'onSignedOut'>) {
  const [days, setDays] = useState(30);
  const [state, setState] = useState<string>();
  const download = async () => {
    setState('готовлю…');
    try {
      await api.exportCsv(session, days);
      setState(undefined);
    } catch (reason) {
      if (reason instanceof SignedOut) onSignedOut();
      else setState(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return (
    <section className={styles.card}>
      <h2>Выгрузка</h2>
      <p>Все события периода в CSV: открывается в Excel и Google Таблицах.</p>
      <div className={styles.segmented} role="group" aria-label="Период выгрузки">
        {EXPORT_PERIODS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={value === days}
            onClick={() => setDays(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <button type="button" className={styles.button} onClick={download} disabled={!!state}>
        скачать CSV
      </button>
      {state && <p className={styles.dim}>{state}</p>}
    </section>
  );
}

function HealthCard({ session, onSignedOut }: Pick<ViewProps, 'session' | 'onSignedOut'>) {
  const { data, error } = useLoad(() => api.health(session), 'health', onSignedOut);
  return (
    <section className={styles.card}>
      <h2>База</h2>
      {error && <p className={styles.error}>{error}</p>}
      {data && (
        <dl className={styles.facts}>
          <dt>событий</dt>
          <dd>{formatNumber(data.events)}</dd>
          <dt>размер</dt>
          <dd>{formatBytes(data.bytes)}</dd>
          <dt>первое</dt>
          <dd>{data.oldest ? formatDateTime(data.oldest) : '—'}</dd>
          <dt>последнее</dt>
          <dd>{data.newest ? formatDateTime(data.newest) : '—'}</dd>
          <dt>хранится</dt>
          <dd>{data.retentionDays} дней, старое удаляется каждую ночь</dd>
        </dl>
      )}
    </section>
  );
}
