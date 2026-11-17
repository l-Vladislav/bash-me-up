/**
 * The admin API the admin page (`src/admin/`) reads. Every handler here runs
 * only after the caller's token has been checked.
 *
 *   GET /api/admin/overview?days=30     counters, the daily curve, the top lists
 *   GET /api/admin/events?before=&type=  the feed of views and commands, newest first
 *   GET /api/admin/visitor?id=           everything one visitor did
 *   GET /api/admin/health                how big the database is and what it spans
 *   GET /api/admin/export?days=30        the events of the period as CSV
 */
import { toCsv } from './csv';
import type {
  DayCount,
  Feed,
  Health,
  Overview,
  Top,
  TopKey,
  VisitEvent,
  VisitorStory,
} from './types';

export const DAY = 86_400_000;
export const RETENTION_DAYS = 365;
export const PERIODS = [1, 7, 30, 90, 365] as const;
/** "On the site now": seen within this long. */
const ONLINE_WINDOW = 5 * 60_000;
const FEED_PAGE = 100;
const STORY_LIMIT = 500;

const EVENT_COLUMNS =
  'id, at, type, name, visitor, country, region, city, network, referrer, device, browser, os, lang, screen';

export const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });

const periodOf = (url: URL): number => {
  const requested = Number(url.searchParams.get('days'));
  return PERIODS.find((period) => period === requested) ?? 30;
};

/** Top lists: label expression, event type, how many rows. */
const TOPS: Record<TopKey, [string, 'view' | 'command', number]> = {
  countries: ['country', 'view', 20],
  cities: ["city || ', ' || COALESCE(region || ', ', '') || country", 'view', 20],
  referrers: ['referrer', 'view', 20],
  networks: ['network', 'view', 20],
  pages: ['name', 'view', 20],
  commands: ['name', 'command', 40],
  devices: ["device || ' · ' || os", 'view', 15],
  browsers: ['browser', 'view', 15],
  languages: ['lang', 'view', 15],
};

export async function overview(url: URL, db: D1Database, now = Date.now()): Promise<Response> {
  const days = periodOf(url);
  const since = now - days * DAY;
  const today = new Date(now).toISOString().slice(0, 10);

  const one = async <T>(sql: string, ...values: unknown[]): Promise<T> =>
    (await db
      .prepare(sql)
      .bind(...values)
      .first<T>()) as T;

  const tops = Object.entries(TOPS).map(([key, [label, type, limit]]) =>
    db
      .prepare(
        `SELECT ${label} AS label, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS hits
         FROM events WHERE at >= ? AND type = ? AND ${label} IS NOT NULL
         GROUP BY 1 ORDER BY visitors DESC, hits DESC LIMIT ${limit}`,
      )
      .bind(since, type)
      .all<Top>()
      .then(({ results }) => [key, results] as const),
  );

  const [online, todayRow, totals, newVisitors, daily, topLists] = await Promise.all([
    one<{ n: number }>(
      'SELECT COUNT(DISTINCT visitor) AS n FROM events WHERE at >= ?',
      now - ONLINE_WINDOW,
    ),
    one<{ views: number; visitors: number }>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
       FROM events WHERE day = ? AND type = 'view'`,
      today,
    ),
    one<{ views: number; visitors: number; countries: number; commands: number }>(
      `SELECT SUM(type = 'view') AS views,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN visitor END) AS visitors,
              COUNT(DISTINCT CASE WHEN type = 'view' THEN country END) AS countries,
              SUM(type = 'command') AS commands
       FROM events WHERE at >= ?`,
      since,
    ),
    one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM (
         SELECT MIN(at) AS first FROM events WHERE type = 'view'
         GROUP BY visitor HAVING MAX(at) >= ?
       ) WHERE first >= ?`,
      since,
      since,
    ),
    db
      .prepare(
        `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
         FROM events WHERE at >= ? AND type = 'view' GROUP BY day ORDER BY day`,
      )
      .bind(since)
      .all<DayCount>(),
    Promise.all(tops),
  ]);

  const body: Overview = {
    days,
    online: online?.n ?? 0,
    today: { views: todayRow?.views ?? 0, visitors: todayRow?.visitors ?? 0 },
    totals: {
      views: totals?.views ?? 0,
      visitors: totals?.visitors ?? 0,
      newVisitors: newVisitors?.n ?? 0,
      countries: totals?.countries ?? 0,
      commands: totals?.commands ?? 0,
    },
    daily: daily.results,
    tops: Object.fromEntries(topLists) as Record<TopKey, Top[]>,
  };
  return json(body);
}

export async function events(url: URL, db: D1Database): Promise<Response> {
  const before = Number(url.searchParams.get('before')) || Number.MAX_SAFE_INTEGER;
  const type = url.searchParams.get('type');
  const typed = type === 'view' || type === 'command';
  const { results } = await db
    .prepare(
      `SELECT ${EVENT_COLUMNS} FROM events
       WHERE id < ? ${typed ? 'AND type = ?' : ''}
       ORDER BY id DESC LIMIT ${FEED_PAGE}`,
    )
    .bind(...(typed ? [before, type] : [before]))
    .all<VisitEvent>();
  const last = results.at(-1);
  const body: Feed = {
    events: results,
    next: results.length === FEED_PAGE && last ? last.id : null,
  };
  return json(body);
}

export async function visitor(url: URL, db: D1Database): Promise<Response> {
  const id = url.searchParams.get('id') ?? '';
  if (!/^[0-9a-f]{16}$/.test(id)) return json({ error: 'bad id' }, { status: 400 });

  const [summary, story] = await Promise.all([
    db
      .prepare(
        `SELECT MIN(at) AS first, MAX(at) AS last, COUNT(DISTINCT day) AS days,
                SUM(type = 'view') AS views, SUM(type = 'command') AS commands
         FROM events WHERE visitor = ?`,
      )
      .bind(id)
      .first<{
        first: number | null;
        last: number;
        days: number;
        views: number;
        commands: number;
      }>(),
    db
      .prepare(
        `SELECT ${EVENT_COLUMNS} FROM events WHERE visitor = ? ORDER BY id DESC LIMIT ${STORY_LIMIT}`,
      )
      .bind(id)
      .all<VisitEvent>(),
  ]);
  if (!summary?.first) return json({ error: 'not found' }, { status: 404 });

  const body: VisitorStory = {
    visitor: id,
    first: summary.first,
    last: summary.last,
    days: summary.days,
    views: summary.views,
    commands: summary.commands,
    events: story.results,
  };
  return json(body);
}

export async function health(db: D1Database): Promise<Response> {
  const result = await db
    .prepare('SELECT COUNT(*) AS events, MIN(at) AS oldest, MAX(at) AS newest FROM events')
    .all<{ events: number; oldest: number | null; newest: number | null }>();
  const row = result.results[0];
  const body: Health = {
    events: row?.events ?? 0,
    oldest: row?.oldest ?? null,
    newest: row?.newest ?? null,
    bytes: result.meta.size_after,
    retentionDays: RETENTION_DAYS,
  };
  return json(body);
}

export async function exportCsv(url: URL, db: D1Database, now = Date.now()): Promise<Response> {
  const days = periodOf(url);
  const { results } = await db
    .prepare(`SELECT ${EVENT_COLUMNS} FROM events WHERE at >= ? ORDER BY id`)
    .bind(now - days * DAY)
    .all<VisitEvent>();
  const rows = results.map((event) => ({ ...event, at: new Date(event.at).toISOString() }));
  const day = new Date(now).toISOString().slice(0, 10);
  return new Response(toCsv(EVENT_COLUMNS.split(', '), rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="visits-${days}d-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
