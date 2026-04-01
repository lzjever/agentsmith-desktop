import { buildLocalhostCallbackUrl, parseDesktopAuthCallbackUrl } from '../callback';

describe('desktop auth callback helpers', () => {
  it('builds a localhost callback url with the requested port', () => {
    expect(buildLocalhostCallbackUrl(38111)).toBe('http://127.0.0.1:38111/desktop/auth/callback');
  });

  it('parses callback params from a localhost redirect', () => {
    expect(parseDesktopAuthCallbackUrl('http://127.0.0.1:38111/desktop/auth/callback?code=abc&state=xyz')).toEqual({
      code: 'abc',
      state: 'xyz',
      error: null,
    });
  });
});
