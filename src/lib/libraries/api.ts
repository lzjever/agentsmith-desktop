import type { DesktopLibrary, DesktopAuthSession } from '../../types';

export interface DesktopLibrariesFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface DesktopLibrariesListResponse {
  items: DesktopLibrary[];
}

export async function fetchDesktopLibraries(args: {
  apiBaseUrl: string;
  authSession: DesktopAuthSession;
  fetchImpl?: DesktopLibrariesFetch;
}): Promise<DesktopLibrary[]> {
  const response = await (args.fetchImpl ?? fetch)(`${args.apiBaseUrl}/me/desktop/file-libraries`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${args.authSession.access_token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`desktop_libraries_failed_${response.status}`);
  }
  const payload = await response.json() as DesktopLibrariesListResponse;
  return payload.items;
}
