import { createPkceChallenge, randomBase64Url } from '../pkce';

describe('pkce helpers', () => {
  it('generates URL-safe random strings', () => {
    const value = randomBase64Url(32);
    expect(value).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(value.length).toBe(32);
  });

  it('creates an S256 challenge', async () => {
    const result = await createPkceChallenge('desktop-test-verifier');
    expect(result.method).toBe('S256');
    expect(result.challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(result.challenge.length).toBeGreaterThan(10);
  });
});
