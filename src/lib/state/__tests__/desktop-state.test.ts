import {
  DEFAULT_DESKTOP_STATE,
  activateLibrary,
  completeDesktopSignIn,
  connectDeployment,
  deactivateLibrary,
  markLibraryMounted,
  markLibraryMountFailed,
  markLibraryUnmounted,
  restoreActiveLibraries,
  setLibraryAlias,
  signOutDesktop,
} from '../desktop-state';

describe('desktop state', () => {
  it('activates and restores libraries', () => {
    const active = activateLibrary(DEFAULT_DESKTOP_STATE, 'lib_1');
    expect(restoreActiveLibraries(active)).toEqual(['lib_1']);
  });

  it('deactivates libraries cleanly', () => {
    const active = activateLibrary(DEFAULT_DESKTOP_STATE, 'lib_1');
    expect(deactivateLibrary(active, 'lib_1').active_library_ids).toEqual([]);
  });

  it('tracks mount lifecycle and diagnostics', () => {
    const activating = activateLibrary(DEFAULT_DESKTOP_STATE, 'lib_1');
    expect(activating.mount_states.lib_1?.state).toBe('activating');

    const mounted = markLibraryMounted(activating, 'lib_1', '~/AgentSmith/ws/lib_1');
    expect(mounted.mount_states.lib_1).toEqual({
      state: 'active',
      mount_target: '~/AgentSmith/ws/lib_1',
      last_error: null,
    });

    const failed = markLibraryMountFailed(mounted, 'lib_1', 'spawn_failed');
    expect(failed.mount_states.lib_1?.state).toBe('failed');
    expect(failed.diagnostics.last_mount_error).toBe('spawn_failed');

    const unmounted = markLibraryUnmounted(failed, 'lib_1');
    expect(unmounted.mount_states.lib_1).toEqual({
      state: 'idle',
      mount_target: null,
      last_error: null,
    });
  });

  it('stores and removes aliases', () => {
    const aliased = setLibraryAlias(DEFAULT_DESKTOP_STATE, 'lib_1', 'Work Files');
    expect(aliased.library_aliases.lib_1).toBe('Work Files');
    expect(setLibraryAlias(aliased, 'lib_1', '   ').library_aliases.lib_1).toBeUndefined();
  });

  it('connects a deployment and completes sign-in', () => {
    const connected = connectDeployment(DEFAULT_DESKTOP_STATE, 'https://agentsmith.example.com', {
      deployment_base_url: 'https://agentsmith.example.com',
      issuer: 'https://agentsmith.example.com/realms/mbos',
      authorization_endpoint: 'https://agentsmith.example.com/auth',
      token_endpoint: 'https://agentsmith.example.com/token',
      client_id: 'agentsmith-desktop',
      scopes: ['openid', 'profile', 'email'],
      response_type: 'code',
      pkce_method: 'S256',
      suggested_callback_origin: 'http://127.0.0.1',
      suggested_callback_path: '/desktop/auth/callback',
    });
    const signedIn = completeDesktopSignIn(connected, {
      access_token: 'token',
      refresh_token: 'refresh',
      expires_at: 123,
    }, {
      id: 'user_1',
      email: 'user@example.com',
      name: 'User Example',
    });
    expect(signedIn.signed_in_user?.email).toBe('user@example.com');
    expect(signedIn.auth_session?.access_token).toBe('token');
  });

  it('signs out while keeping the connected deployment', () => {
    const signedOut = signOutDesktop({
      ...DEFAULT_DESKTOP_STATE,
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        issuer: 'https://agentsmith.example.com/realms/mbos',
        authorization_endpoint: 'https://agentsmith.example.com/auth',
        token_endpoint: 'https://agentsmith.example.com/token',
        client_id: 'agentsmith-desktop',
        scopes: ['openid', 'profile', 'email'],
        response_type: 'code',
        pkce_method: 'S256',
        suggested_callback_origin: 'http://127.0.0.1',
        suggested_callback_path: '/desktop/auth/callback',
      },
      auth_session: {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_at: 123,
      },
      signed_in_user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
    });
    expect(signedOut.signed_in_user).toBeNull();
    expect(signedOut.auth_session).toBeNull();
    expect(signedOut.deployment_base_url).toBe('https://agentsmith.example.com');
  });
});
