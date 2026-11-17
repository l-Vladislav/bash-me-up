import { describe, expect, it } from 'vitest';
import { TOKEN_TTL, makeToken, verifyToken } from './auth';
import { toCsv } from './csv';

const NOW = Date.UTC(2026, 10, 17);

describe('sign-in tokens', () => {
  it('accepts its own token until it expires', async () => {
    const { token, expires } = await makeToken('secret', NOW);
    expect(expires).toBe(NOW + TOKEN_TTL);
    expect(await verifyToken('secret', token, NOW + 1000)).toBe(true);
    expect(await verifyToken('secret', token, expires)).toBe(false);
  });

  it('refuses a token signed with another secret (a changed password)', async () => {
    const { token } = await makeToken('old password', NOW);
    expect(await verifyToken('new password', token, NOW)).toBe(false);
  });

  it('refuses a token whose expiry was pushed forward', async () => {
    const { token } = await makeToken('secret', NOW);
    const [, signature] = token.split('.');
    expect(await verifyToken('secret', `${NOW + TOKEN_TTL + 5}.${signature}`, NOW)).toBe(false);
  });

  it('refuses garbage', async () => {
    for (const token of ['', '.', 'abc', '123.zz', '123.ab.cd', `${NOW + 10}.`]) {
      expect(await verifyToken('secret', token, NOW)).toBe(false);
    }
  });
});

describe('toCsv', () => {
  it('quotes what needs quoting and leaves the rest alone', () => {
    expect(
      toCsv(
        ['a', 'b', 'c'],
        [
          { a: 'plain', b: 'with, comma', c: null },
          { a: 'say "hi"', b: 3 },
        ],
      ),
    ).toBe('a,b,c\r\nplain,"with, comma",\r\n"say ""hi""",3,');
  });

  it('defuses spreadsheet formulas but keeps negative numbers', () => {
    expect(toCsv(['x'], [{ x: '=HYPERLINK("evil")' }, { x: '-5' }])).toBe(
      'x\r\n"\'=HYPERLINK(""evil"")"\r\n-5',
    );
  });
});
