/**
 * Sign-in tokens for the admin page: `<expiry>.<HMAC of the expiry>`.
 *
 * Nothing is stored on the server. The key is made from the password and the
 * salt, so changing the password signs everyone out.
 */

/** How long a sign-in lasts. */
export const TOKEN_TTL = 30 * 86_400_000;

const encoder = new TextEncoder();

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const unhex = (text: string): Uint8Array | null => {
  if (!/^(?:[0-9a-f]{2})+$/.test(text)) return null;
  return new Uint8Array(text.match(/../g)?.map((pair) => parseInt(pair, 16)) ?? []);
};

const signingKey = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

const payload = (expires: number): BufferSource => encoder.encode(`admin|${expires}`);

export const makeToken = async (
  secret: string,
  now: number,
): Promise<{ token: string; expires: number }> => {
  const expires = now + TOKEN_TTL;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(secret), payload(expires));
  return { token: `${expires}.${hex(signature)}`, expires };
};

/** True for a token this secret signed that has not expired yet. */
export const verifyToken = async (secret: string, token: string, now: number): Promise<boolean> => {
  const [expiry, signature, ...rest] = token.split('.');
  if (!expiry || !signature || rest.length > 0 || !/^\d{1,15}$/.test(expiry)) return false;
  const expires = Number(expiry);
  if (expires <= now || expires > now + TOKEN_TTL) return false;
  const bytes = unhex(signature);
  if (!bytes) return false;
  // `verify` compares in constant time.
  return crypto.subtle.verify('HMAC', await signingKey(secret), bytes, payload(expires));
};
