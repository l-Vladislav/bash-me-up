/**
 * Visit counter for the terminal site.
 *
 *   POST /api/terminal       the site reports a page view or a command (no cookies)
 *   POST /api/admin/login    the admin page trades the password for a token
 *   GET  /api/admin/*        the admin page's data, with that token (see admin.ts)
 *   GET  /                   sends you to the admin page
 *
 * Country, city and network come from Cloudflare's own lookup of the request.
 * The visitor is the random ID the site keeps in the browser, hashed with a
 * secret, so a person who comes back on another day is still one visitor.
 * When the browser sends none (storage blocked), it is a hash of IP and user
 * agent salted with the secret and the date, good for that day only.
 */
import { DAY, RETENTION_DAYS, events, exportCsv, health, json, overview, visitor } from './admin';
import { makeToken, verifyToken } from './auth';
import type { Session } from './types';
import { clean, describeDevice, isBot, referrerHost, visitorId } from './visit';

interface Env {
  DB: D1Database;
  /** Secret mixed into the visitor hash and the sign-in tokens. */
  SALT: string;
  /** Password for the admin page. */
  PASSWORD: string;
  /** Comma-separated origins allowed to report visits and read the admin API. */
  ALLOWED_ORIGINS: string;
  /** Where `/` sends you: the admin page on the site. */
  ADMIN_URL?: string;
  /** Limits sign-in attempts per address (wrangler.toml `ratelimits`). */
  LOGIN_LIMITER?: RateLimit;
}

const EVENT_TYPES = new Set(['view', 'command']);
const MAX_BODY = 2048;

const allowedOrigins = (env: Env): string[] =>
  env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const sha256 = async (text: string): Promise<ArrayBuffer> =>
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

const noContent = (): Response => new Response(null, { status: 204 });

async function record(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  if (!allowedOrigins(env).includes(origin)) return new Response(null, { status: 403 });

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
  const id = visitorId(body.vid);
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const visitor = hex(
    await sha256(id ? `${env.SALT}|id|${id}` : `${env.SALT}|${day}|${ip}|${userAgent}`),
  ).slice(0, 16);

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

/* ---- Admin ---------------------------------------------------------------- */

/** The admin page's own origin, or a local dev server. */
const adminOrigin = (request: Request, env: Env): string | null => {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  if (allowedOrigins(env).includes(origin)) return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? origin : null;
};

const withCors = (response: Response, origin: string | null): Response => {
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
  headers.append('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
};

const preflight = (origin: string | null): Response =>
  origin
    ? new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      })
    : new Response(null, { status: 403 });

/** Signs tokens; made from the password, so a new password signs everyone out. */
const tokenSecret = (env: Env): string => `${env.SALT}|admin|${env.PASSWORD}`;

async function login(request: Request, env: Env): Promise<Response> {
  if (!env.PASSWORD) return json({ error: 'no password set' }, { status: 503 });

  // A handful of tries a minute per address, so the password cannot be guessed by brute force.
  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  const key = hex(await sha256(`${env.SALT}|login|${ip}`)).slice(0, 32);
  if (env.LOGIN_LIMITER && !(await env.LOGIN_LIMITER.limit({ key })).success) {
    return json({ error: 'too many tries' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === 'string') password = body.password.slice(0, 256);
  } catch {
    return json({ error: 'bad request' }, { status: 400 });
  }

  // Compare digests, so the check takes the same time whatever was typed.
  const [given, expected] = await Promise.all([sha256(password), sha256(env.PASSWORD)]);
  if (!crypto.subtle.timingSafeEqual(given, expected)) {
    return json({ error: 'wrong password' }, { status: 401 });
  }
  const session: Session = await makeToken(tokenSecret(env), Date.now());
  return json(session);
}

async function signedIn(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ') || !env.PASSWORD) return false;
  return verifyToken(tokenSecret(env), header.slice(7).trim(), Date.now());
}

async function admin(request: Request, env: Env, url: URL): Promise<Response> {
  if (request.method === 'POST' && url.pathname === '/api/admin/login') return login(request, env);
  if (request.method !== 'GET') return json({ error: 'not found' }, { status: 404 });
  if (!(await signedIn(request, env))) return json({ error: 'sign in' }, { status: 401 });

  switch (url.pathname) {
    case '/api/admin/overview':
      return overview(url, env.DB);
    case '/api/admin/events':
      return events(url, env.DB);
    case '/api/admin/visitor':
      return visitor(url, env.DB);
    case '/api/admin/health':
      return health(env.DB);
    case '/api/admin/export':
      return exportCsv(url, env.DB);
    default:
      return json({ error: 'not found' }, { status: 404 });
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === '/api/terminal' && request.method === 'POST') return record(request, env);

    if (pathname.startsWith('/api/admin/')) {
      const origin = adminOrigin(request, env);
      if (request.method === 'OPTIONS') return preflight(origin);
      return withCors(await admin(request, env, url), origin);
    }

    if (pathname === '/' && request.method === 'GET' && env.ADMIN_URL) {
      return Response.redirect(env.ADMIN_URL, 302);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(_controller, env): Promise<void> {
    await env.DB.prepare('DELETE FROM events WHERE at < ?')
      .bind(Date.now() - RETENTION_DAYS * DAY)
      .run();
  },
} satisfies ExportedHandler<Env>;
