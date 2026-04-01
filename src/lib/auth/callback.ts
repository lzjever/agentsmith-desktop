export interface DesktopAuthCallbackResult {
  code: string | null;
  state: string | null;
  error: string | null;
}

export function buildLocalhostCallbackUrl(port: number, path = '/desktop/auth/callback'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `http://127.0.0.1:${port}${normalizedPath}`;
}

export function parseDesktopAuthCallbackUrl(input: string): DesktopAuthCallbackResult {
  const url = new URL(input, 'http://127.0.0.1');
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
  };
}
