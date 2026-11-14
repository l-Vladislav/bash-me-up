/**
 * Pure helpers that turn a raw request into the few facts worth keeping.
 * No IP address or full user agent is ever stored: only what they say about
 * the kind of device, and a hash that changes every day.
 */

/** Crawlers, link previews, monitors and headless browsers. */
const BOTS =
  /bot|crawl|spider|slurp|preview|fetch|monitor|lighthouse|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|httpclient|go-http|java\/|axios|node-fetch|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|vkshare/i;

export const isBot = (userAgent: string): boolean => userAgent.length < 20 || BOTS.test(userAgent);

export interface Device {
  device: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
}

const firstMatch = (
  userAgent: string,
  rules: readonly [RegExp, string][],
  fallback: string,
): string => rules.find(([pattern]) => pattern.test(userAgent))?.[1] ?? fallback;

/** Order matters: Edge and Opera also say Chrome, Chrome also says Safari. */
const BROWSERS: readonly [RegExp, string][] = [
  [/edg\//i, 'Edge'],
  [/opr\/|opera/i, 'Opera'],
  [/yabrowser/i, 'Yandex'],
  [/samsungbrowser/i, 'Samsung'],
  [/firefox|fxios/i, 'Firefox'],
  [/chrome|crios|chromium/i, 'Chrome'],
  [/safari/i, 'Safari'],
];

const SYSTEMS: readonly [RegExp, string][] = [
  [/windows/i, 'Windows'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/android/i, 'Android'],
  [/mac os x|macintosh/i, 'macOS'],
  [/cros/i, 'ChromeOS'],
  [/linux/i, 'Linux'],
];

export const describeDevice = (userAgent: string): Device => {
  const tablet = /ipad|tablet|(android(?!.*mobile))/i.test(userAgent);
  const mobile = !tablet && /mobi|iphone|ipod|android/i.test(userAgent);
  return {
    device: tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
    browser: firstMatch(userAgent, BROWSERS, 'Other'),
    os: firstMatch(userAgent, SYSTEMS, 'Other'),
  };
};

/**
 * Where the visitor came from, as a host name: `www.linkedin.com` becomes
 * `linkedin.com`. Null for a direct visit or a move within the site itself.
 */
export const referrerHost = (referrer: string, ownHost: string): string | null => {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    // Android apps announce themselves as android-app://com.linkedin.android/
    const host =
      url.protocol === 'android-app:' ? url.hostname : url.hostname.replace(/^www\./, '');
    if (!host || host === ownHost) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
};

/** Trims a client-supplied string to something safe to store. */
export const clean = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const text = [...value]
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('')
    .trim();
  return text ? text.slice(0, max) : null;
};

/** Regional indicator letters: `NO` becomes the Norwegian flag. */
export const flag = (country: string | null): string =>
  country && /^[A-Z]{2}$/.test(country)
    ? String.fromCodePoint(...[...country].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))
    : '';
