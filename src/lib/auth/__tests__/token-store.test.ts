import type { DesktopState } from '../../../types';
import {
  clearDesktopSession,
  clearPkceContext,
  loadDesktopSession,
  loadPkceContext,
  saveDesktopSession,
  savePkceContext,
} from '../token-store';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

const COMPLETE_STATE: DesktopState = {
  deployment_base_url: 'https://agentsmith.example.com',
  auth_config: {
    deployment_base_url: 'https://agentsmith.example.com',
    issuer: 'https://agentsmith.example.com/realms/mbos',
    authorization_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/auth',
    token_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/token',
    client_id: 'agentsmith-desktop',
    scopes: ['openid', 'profile', 'email'],
    response_type: 'code',
    pkce_method: 'S256',
    suggested_callback_origin: 'http://127.0.0.1',
    suggested_callback_path: '/desktop/auth/callback',
  },
  auth_session: {
    access_token: 'token_a',
    refresh_token: 'refresh_a',
    expires_at: 123,
  },
  signed_in_user: {
    id: 'user_1',
    email: 'user@example.com',
    name: 'User Example',
  },
  libraries: [],
  active_library_ids: ['lib_1'],
  library_aliases: {
    lib_1: 'Work Files',
  },
};

describe('desktop token store', () => {
  it('persists and restores a complete desktop session', () => {
    const storage = createMemoryStorage();
    saveDesktopSession(storage, COMPLETE_STATE);
    expect(loadDesktopSession(storage)).toMatchObject({
      deployment_base_url: 'https://agentsmith.example.com',
      signed_in_user: {
        email: 'user@example.com',
      },
      active_library_ids: ['lib_1'],
    });
  });

  it('clears persisted session state', () => {
    const storage = createMemoryStorage();
    saveDesktopSession(storage, COMPLETE_STATE);
    clearDesktopSession(storage);
    expect(loadDesktopSession(storage)).toBeNull();
  });

  it('persists and restores PKCE context', () => {
    const storage = createMemoryStorage();
    savePkceContext(storage, {
      deployment_base_url: 'https://agentsmith.example.com',
      state: 'state_a',
      verifier: 'verifier_a',
      callback_url: 'http://127.0.0.1:38111/desktop/auth/callback',
    });
    expect(loadPkceContext(storage)).toEqual({
      deployment_base_url: 'https://agentsmith.example.com',
      state: 'state_a',
      verifier: 'verifier_a',
      callback_url: 'http://127.0.0.1:38111/desktop/auth/callback',
    });
    clearPkceContext(storage);
    expect(loadPkceContext(storage)).toBeNull();
  });
});
