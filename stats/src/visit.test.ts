import { describe, expect, it } from 'vitest';
import { clean, describeDevice, flag, isBot, referrerHost } from './visit';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const EDGE_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

describe('isBot', () => {
  it('lets browsers through', () => {
    expect(isBot(CHROME_WINDOWS)).toBe(false);
    expect(isBot(SAFARI_IPHONE)).toBe(false);
  });

  it('stops crawlers, link previews and scripts', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      true,
    );
    expect(
      isBot(
        'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      ),
    ).toBe(true);
    expect(isBot('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isBot('Mozilla/5.0 HeadlessChrome/142.0.0.0')).toBe(true);
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot('')).toBe(true);
  });
});

describe('describeDevice', () => {
  it('tells the browser, system and kind of device apart', () => {
    expect(describeDevice(CHROME_WINDOWS)).toEqual({
      device: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
    });
    expect(describeDevice(SAFARI_IPHONE)).toEqual({
      device: 'mobile',
      browser: 'Safari',
      os: 'iOS',
    });
    expect(describeDevice(EDGE_MAC)).toEqual({ device: 'desktop', browser: 'Edge', os: 'macOS' });
    expect(describeDevice(ANDROID_TABLET)).toEqual({
      device: 'tablet',
      browser: 'Chrome',
      os: 'Android',
    });
  });
});

describe('referrerHost', () => {
  it('keeps the host of another site, without www', () => {
    expect(referrerHost('https://www.linkedin.com/in/someone/', 'l-vladislav.github.io')).toBe(
      'linkedin.com',
    );
    expect(referrerHost('android-app://com.linkedin.android/', 'l-vladislav.github.io')).toBe(
      'com.linkedin.android',
    );
  });

  it('drops direct visits, the site itself and junk', () => {
    expect(referrerHost('', 'l-vladislav.github.io')).toBeNull();
    expect(
      referrerHost('https://l-vladislav.github.io/bash-me-up/', 'l-vladislav.github.io'),
    ).toBeNull();
    expect(referrerHost('not a url', 'l-vladislav.github.io')).toBeNull();
  });
});

describe('clean', () => {
  it('trims, strips control characters and caps the length', () => {
    expect(clean('  en-US\n', 10)).toBe('en-US');
    expect(clean('abcdef', 3)).toBe('abc');
    expect(clean(42, 10)).toBeNull();
    expect(clean('   ', 10)).toBeNull();
  });
});

describe('flag', () => {
  it('turns a country code into its flag', () => {
    expect(flag('NO')).toBe('🇳🇴');
    expect(flag(null)).toBe('');
    expect(flag('T1')).toBe('');
  });
});
