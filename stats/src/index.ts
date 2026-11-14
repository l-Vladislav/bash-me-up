/**
 * Visit counter for the terminal site.
 *
 *   POST /event  the site reports a page view or a command (sendBeacon, no cookies)
 *   GET  /       the dashboard, behind HTTP Basic auth (any user name, PASSWORD)
 *
 * Country, city and network come from Cloudflare's own lookup of the request.
 * The visitor is a hash of IP and user agent salted with a secret and the
 * date, so a person counts once a day and cannot be followed across days.
 */
import { clean, describeDevice, flag, isBot, referrerHost } from './visit';

interface Env {
  DB: D1Database;
  /** Secret mixed into the daily visitor hash. */
  SALT: string;
  /** Password for the dashboard. */
  PASSWORD: string;
  /** Comma-separated origins allowed to report visits. */
  ALLOWED_ORIGINS: string;
}

const EVENT_TYPES = new Set(['view', 'command']);
const MAX_BODY = 2048;
const DAY = 86_400_000;
/** Events older than this are deleted by the daily cron. */
const RETENTION_DAYS = 365;
const PERIODS = [7, 30, 90, 365] as const;

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256 = async (text: string): Promise<ArrayBuffer> =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

const noContent = (): Response => new Response(null, { status: 204 });

async function record(request: Request, env: Env): Promise<Response> {
  const origins = env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
  const origin = request.headers.get('Origin') ?? '';
  if (!origins.includes(origin)) return new Response(null, { status: 403 });

  const userAgent = request.headers.get('User-Agent') ?? '';
  // Bots get the same answer as everyone else, so there is nothing to probe.
  if (isBot(userAgent)) return noContent();

  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  const type = clean(body.type, 16);
  const name = clean(body.name, 64);
  if (!type || !EVENT_TYPES.has(type) || !name) return new Response(null, { status: 400 });

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const visitor = hex(await sha256(`${env.SALT}|${day}|${ip}|${userAgent}`)).slice(0, 16);

  const cf = request.cf;
  const { device, browser, os } = describeDevice(userAgent);
  const ownHost = new URL(origin).hostname;

  await env.DB.prepare(
    `INSERT INTO events (at, day, type, name, visitor, country, region, city, network,
       referrer, device, browser, os, lang, screen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      now,
      day,
      type,
      name,
      visitor,
      clean(cf?.country, 2),
      clean(cf?.region, 64),
      clean(cf?.city, 64),
      clean(cf?.asOrganization, 100),
      referrerHost(clean(body.referrer, 500) ?? '', ownHost),
      device,
      browser,
      os,
      clean(body.lang, 16),
      clean(body.screen, 16),
    )
    .run();

  return noContent();
}

/* ---- Dashboard ------------------------------------------------------------ */

async function authorised(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Basic ') || !env.PASSWORD) return false;
  let password: string;
  try {
    password = atob(header.slice(6)).split(':').slice(1).join(':');
  } catch {
    return false;
  }
  // Compare digests, so the check takes the same time whatever was typed.
  const [given, expected] = await Promise.all([sha256(password), sha256(env.PASSWORD)]);
  return crypto.subtle.timingSafeEqual(given, expected);
}

const escape = (value: unknown): string =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );

type Row = Record<string, string | number | null>;

const table = (title: string, headers: readonly string[], rows: readonly string[][]): string => `
  <section>
    <h2>${escape(title)}</h2>
    ${
      rows.length === 0
        ? '<p class="empty">пока пусто</p>'
        : `<table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead>
           <tbody>${rows.map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    }
  </section>`;

const place = (row: Row): string =>
  [
    flag(row.country as string | null),
    [row.city, row.country].filter(Boolean).map(escape).join(', '),
  ]
    .filter(Boolean)
    .join(' ') || '—';

async function dashboard(request: Request, env: Env): Promise<Response> {
  const requested = Number(new URL(request.url).searchParams.get('days'));
  const days = PERIODS.find((period) => period === requested) ?? 30;
  const since = Date.now() - days * DAY;

  const query = async (sql: string): Promise<Row[]> =>
    (await env.DB.prepare(sql).bind(since).all<Row>()).results;

  const top = (column: string, type = 'view', limit = 15): Promise<Row[]> =>
    query(`SELECT ${column} AS label, COUNT(DISTINCT visitor) AS visitors, COUNT(*) AS hits
           FROM events WHERE at >= ? AND type = '${type}' AND ${column} IS NOT NULL
           GROUP BY ${column} ORDER BY visitors DESC, hits DESC LIMIT ${limit}`);

  const [
    totals,
    daily,
    countries,
    cities,
    referrers,
    networks,
    commands,
    devices,
    browsers,
    recent,
  ] = await Promise.all([
    query(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                    COUNT(DISTINCT country) AS countries
             FROM events WHERE at >= ? AND type = 'view'`),
    query(`SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
             FROM events WHERE at >= ? AND type = 'view' GROUP BY day ORDER BY day DESC`),
    top('country'),
    query(`SELECT city, region, country, COUNT(DISTINCT visitor) AS visitors
             FROM events WHERE at >= ? AND type = 'view' AND city IS NOT NULL
             GROUP BY city, country ORDER BY visitors DESC LIMIT 20`),
    top('referrer'),
    top('network'),
    top('name', 'command', 30),
    top("device || ' · ' || os"),
    top('browser'),
    query(`SELECT at, name, country, region, city, network, referrer, device, browser, os, lang
             FROM events WHERE at >= ? AND type = 'view' ORDER BY at DESC LIMIT 100`),
  ]);

  const total = totals[0] ?? { views: 0, visitors: 0, countries: 0 };
  const peak = Math.max(1, ...daily.map((row) => Number(row.visitors)));
  const counted = (rows: Row[], label: (row: Row) => string): string[][] =>
    rows.map((row) => [label(row), String(row.visitors), String(row.hits)]);

  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Посетители</title>
<style>
  :root { color-scheme: dark; --fg: #ffb000; --dim: #a87400; --bg: #0b0907; --line: #2a2214; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 48px; background: var(--bg); color: var(--fg);
         font: 14px/1.5 ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .1em; color: var(--dim); margin: 0 0 8px; }
  nav a { color: var(--dim); margin-right: 12px; } nav a.on { color: var(--fg); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
  .tile { border: 1px solid var(--line); padding: 12px; } .tile b { display: block; font-size: 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
  section { min-width: 0; overflow-x: auto; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 3px 8px 3px 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
  th { color: var(--dim); font-weight: normal; }
  td.bar { width: 60%; } .bar span { display: inline-block; height: 10px; background: var(--fg); opacity: .7; }
  .empty, .note { color: var(--dim); }
</style>
</head>
<body>
<main>
  <h1>Кто заходил на сайт</h1>
  <nav>${PERIODS.map((p) => `<a href="?days=${p}"${p === days ? ' class="on"' : ''}>${p} дн.</a>`).join('')}</nav>
  <div class="tiles">
    <div class="tile"><b>${escape(total.views)}</b>просмотров</div>
    <div class="tile"><b>${escape(total.visitors)}</b>посетителей*</div>
    <div class="tile"><b>${escape(total.countries)}</b>стран</div>
  </div>
  ${table(
    'По дням',
    ['день', 'посетители', 'просмотры', ''],
    daily.map((row) => [
      escape(row.day),
      String(row.visitors),
      String(row.views),
      `<span style="width:${Math.round((Number(row.visitors) / peak) * 100)}%"></span>`,
    ]),
  ).replace(/<td><span/g, '<td class="bar"><span')}
  <div class="grid">
    ${table(
      'Страны',
      ['', 'посетители', 'просмотры'],
      counted(countries, (r) => `${flag(r.label as string)} ${escape(r.label)}`),
    )}
    ${table(
      'Города',
      ['', 'посетители'],
      cities.map((r) => [
        `${place(r)}${r.region ? ` <span class="note">${escape(r.region)}</span>` : ''}`,
        String(r.visitors),
      ]),
    )}
    ${table(
      'Откуда пришли',
      ['', 'посетители', 'просмотры'],
      counted(referrers, (r) => escape(r.label)),
    )}
    ${table(
      'Сети (провайдер / компания)',
      ['', 'посетители', 'просмотры'],
      counted(networks, (r) => escape(r.label)),
    )}
    ${table(
      'Команды',
      ['', 'посетители', 'запуски'],
      counted(commands, (r) => escape(r.label)),
    )}
    ${table(
      'Устройства',
      ['', 'посетители', 'просмотры'],
      counted(devices, (r) => escape(r.label)),
    )}
    ${table(
      'Браузеры',
      ['', 'посетители', 'просмотры'],
      counted(browsers, (r) => escape(r.label)),
    )}
  </div>
  ${table(
    'Последние визиты',
    ['когда', 'где', 'сеть', 'откуда', 'устройство', 'язык', 'страница'],
    recent.map((r) => [
      `<time data-t="${escape(r.at)}">${escape(new Date(Number(r.at)).toISOString().slice(0, 16).replace('T', ' '))}</time>`,
      place(r),
      escape(r.network ?? '—'),
      escape(r.referrer ?? 'напрямую'),
      escape(`${r.device} · ${r.os} · ${r.browser}`),
      escape(r.lang ?? '—'),
      escape(r.name),
    ]),
  )}
  <p class="note">* уникальные за день: тот, кто зашёл в два разных дня, считается дважды.
  Ботов и превью ссылок отсеиваем по User-Agent, но не всех.</p>
</main>
<script>
  for (const t of document.querySelectorAll('time[data-t]'))
    t.textContent = new Date(+t.dataset.t).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/event' && request.method === 'POST') return record(request, env);

    if (pathname === '/' && request.method === 'GET') {
      if (!(await authorised(request, env))) {
        return new Response('Нужен пароль', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="stats", charset="UTF-8"' },
        });
      }
      return dashboard(request, env);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(_controller, env): Promise<void> {
    await env.DB.prepare('DELETE FROM events WHERE at < ?')
      .bind(Date.now() - RETENTION_DAYS * DAY)
      .run();
  },
} satisfies ExportedHandler<Env>;
