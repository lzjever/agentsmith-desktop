const BASE64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function randomBase64Url(bytes = 32): string {
  const random = new Uint8Array(bytes);
  crypto.getRandomValues(random);
  let output = '';
  for (const value of random) {
    output += BASE64_URL_ALPHABET[value % BASE64_URL_ALPHABET.length];
  }
  return output;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = Array.from(new Uint8Array(buffer));
  const binary = bytes.map((value) => String.fromCharCode(value)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createPkceChallenge(
  verifier: string,
): Promise<{ challenge: string; method: 'S256' }> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return {
    challenge: toBase64Url(digest),
    method: 'S256',
  };
}
