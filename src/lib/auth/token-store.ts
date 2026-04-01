import type { DesktopAuthConfig, DesktopAuthSession, DesktopPkceContext, DesktopState, SignedInUser } from '../../types';

const SESSION_STORAGE_KEY = 'agentsmith-desktop:session';
const PKCE_STORAGE_KEY = 'agentsmith-desktop:pkce';

export interface PersistedDesktopSession {
  deployment_base_url: string;
  auth_config: DesktopAuthConfig;
  auth_session: DesktopAuthSession;
  signed_in_user: SignedInUser;
  active_library_ids: string[];
  library_aliases: Record<string, string>;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadDesktopSession(storage: StorageLike): PersistedDesktopSession | null {
  return parseJson<PersistedDesktopSession>(storage.getItem(SESSION_STORAGE_KEY));
}

export function saveDesktopSession(storage: StorageLike, state: DesktopState): void {
  if (!state.deployment_base_url || !state.auth_config || !state.auth_session || !state.signed_in_user) {
    throw new Error('desktop_session_incomplete');
  }
  const payload: PersistedDesktopSession = {
    deployment_base_url: state.deployment_base_url,
    auth_config: state.auth_config,
    auth_session: state.auth_session,
    signed_in_user: state.signed_in_user,
    active_library_ids: state.active_library_ids,
    library_aliases: state.library_aliases,
  };
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearDesktopSession(storage: StorageLike): void {
  storage.removeItem(SESSION_STORAGE_KEY);
}

export function loadPkceContext(storage: StorageLike): DesktopPkceContext | null {
  return parseJson<DesktopPkceContext>(storage.getItem(PKCE_STORAGE_KEY));
}

export function savePkceContext(storage: StorageLike, context: DesktopPkceContext): void {
  storage.setItem(PKCE_STORAGE_KEY, JSON.stringify(context));
}

export function clearPkceContext(storage: StorageLike): void {
  storage.removeItem(PKCE_STORAGE_KEY);
}
