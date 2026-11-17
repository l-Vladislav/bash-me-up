import { useState } from 'react';
import type { DayCount, Top, TopKey } from '../../stats/src/types';
import type { ViewProps } from './Admin';
import { api } from './api';
import { countryLabel, fillDays, formatDay, formatNumber } from './format';
import { useLoad } from './useLoad';
import styles from './Admin.module.css';

const PERIODS = [
  [1, 'сегодня'],
  [7, '7 дней'],
  [30, '30 дней'],
  [90, '90 дней'],
  [365, 'год'],
] as const;

const VIEWS = ['просм.', 'просмотры'] as const;

/** Each list: its key, title, and the short and full name of its second count. */
const TOP_TITLES: [TopKey, string, readonly [string, string]][] = [
  ['countries', 'Страны', VIEWS],
  ['cities', 'Города', VIEWS],
  ['referrers', 'Откуда пришли', VIEWS],
  ['pages', 'Точки входа', VIEWS],
  ['commands', 'Команды', ['запуск.', 'запуски']],
  ['networks', 'Сети (провайдер / компания)', VIEWS],
  ['devices', 'Устройства', VIEWS],
  ['browsers', 'Браузеры', VIEWS],
  ['languages', 'Языки', VIEWS],
];

/** Refreshes on its own while the tab is open. */
const REFRESH = 60_000;

export function OverviewView({ session, onSignedOut }: ViewProps) {
  const [days, setDays] = useState(30);
  const { data, at, error, loading, reload } = useLoad(
    () => api.overview(session, days),
    String(days),
    onSignedOut,
    REFRESH,
  );

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Период">
          {PERIODS.map(([value, label]) => (
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
        <button type="button" className={styles.ghost} onClick={reload} disabled={loading}>
          {loading ? 'обновляю…' : '↻ обновить'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {data && (
        <>
          <div className={styles.tiles}>
            <Tile value={data.online} label="на сайте сейчас" note="за 5 минут" live />
            <Tile
              value={data.today.visitors}
              label="сегодня"
              note={`${formatNumber(data.today.views)} просмотров`}
            />
            <Tile
              value={data.totals.visitors}
              label="посетителей*"
              note={`из них новых ${formatNumber(data.totals.newVisitors)}`}
            />
            <Tile value={data.totals.views} label="просмотров" />
            <Tile value={data.totals.commands} label="команд" />
            <Tile value={data.totals.countries} label="стран" />
          </div>
          {days > 1 && <DailyChart daily={fillDays(data.daily, days, at)} />}
          <div className={styles.grid}>
            {TOP_TITLES.map(([key, title, hits]) => (
              <TopList
                key={key}
                title={title}
                hits={hits}
                rows={data.tops[key]}
                label={key === 'countries' ? countryLabel : (text) => text}
              />
            ))}
          </div>
          <p className={styles.note}>
            * уникальные по браузеру: вернувшийся в другой день считается один раз. Инкогнито,
            очистка данных или другой браузер — новый посетитель; Safari забывает тех, кто не
            заходил неделю. Ботов и превью ссылок отсеиваем по User-Agent, но не всех. Время — UTC
            для дней, местное для событий.
          </p>
        </>
      )}
    </>
  );
}

function Tile({
  value,
  label,
  note,
  live,
}: {
  value: number;
  label: string;
  note?: string;
  live?: boolean;
}) {
  return (
    <div className={styles.tile}>
      <b>
        {live && <span className={value > 0 ? styles.dotOn : styles.dot} aria-hidden />}
        {formatNumber(value)}
      </b>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

function DailyChart({ daily }: { daily: DayCount[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const peak = Math.max(1, ...daily.map((row) => row.visitors));
  const shown = hover === null ? null : daily[hover];
  const first = daily[0];
  const last = daily.at(-1);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>Посетители по дням</h2>
        <span className={styles.readout}>
          {shown
            ? `${formatDay(shown.day)}: ${formatNumber(shown.visitors)} посет. · ${formatNumber(shown.views)} просм.`
            : `пик ${formatNumber(peak)}`}
        </span>
        <button type="button" className={styles.link} onClick={() => setAsTable(!asTable)}>
          {asTable ? 'графиком' : 'таблицей'}
        </button>
      </div>
      {asTable ? (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>день</th>
                <th>посетители</th>
                <th>просмотры</th>
              </tr>
            </thead>
            <tbody>
              {[...daily].reverse().map((row) => (
                <tr key={row.day}>
                  <td>{formatDay(row.day)}</td>
                  <td>{formatNumber(row.visitors)}</td>
                  <td>{formatNumber(row.views)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div
            className={styles.chart}
            role="img"
            aria-label={`Посетители по дням, пик ${peak}`}
            onMouseLeave={() => setHover(null)}
          >
            {daily.map((row, index) => (
              <div
                key={row.day}
                className={index === hover ? styles.columnOn : styles.column}
                onMouseEnter={() => setHover(index)}
                onTouchStart={() => setHover(index)}
              >
                <span style={{ height: `${(row.visitors / peak) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className={styles.axis}>
            <span>{first && formatDay(first.day)}</span>
            <span>{last && formatDay(last.day)}</span>
          </div>
        </>
      )}
    </section>
  );
}

function TopList({
  title,
  hits,
  rows,
  label,
}: {
  title: string;
  hits: readonly [string, string];
  rows: Top[];
  label: (text: string) => string;
}) {
  const peak = Math.max(1, ...rows.map((row) => row.visitors));
  return (
    <section className={styles.card}>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.empty}>пока пусто</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th title="посетители">посет.</th>
              <th title={hits[1]}>{hits[0]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td className={styles.barCell}>
                  <i style={{ width: `${(row.visitors / peak) * 100}%` }} />
                  <span>{label(row.label)}</span>
                </td>
                <td>{formatNumber(row.visitors)}</td>
                <td className={styles.dim}>{formatNumber(row.hits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
