import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { App } from '../App';
import type { DesktopAuthRuntime } from '../lib/auth/runtime';
import type { DesktopDoctorService } from '../lib/doctor/service';
import type { DesktopMountService } from '../lib/mounts/service';
import type { DesktopDoctorCheck } from '../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const API_BASE = 'https://agentsmith.example.com/api/v1';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    invokeMock.mockReset();
    delete (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  function createDoctorService(checks: DesktopDoctorCheck[] = [{
    key: 'juicefs',
    status: 'ready' as const,
    detail: '/usr/bin/juicefs',
  }, {
    key: 'fuse',
    status: 'ready' as const,
    detail: '/usr/bin/fusermount3',
  }]): DesktopDoctorService {
    return {
      runChecks: vi.fn().mockResolvedValue(checks),
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      handoffGuidanceAction: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('connects to a deployment and shows sign-in state', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      api_base_url: API_BASE,
      issuer: 'https://agentsmith.example.com/realms/mbos',
      authorization_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/auth',
      token_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/token',
      client_id: 'agentsmith-desktop',
      scopes: ['openid', 'profile', 'email'],
      response_type: 'code',
      pkce_method: 'S256',
      suggested_callback_origin: 'http://127.0.0.1',
      suggested_callback_path: '/desktop/auth/callback',
    }), { status: 200 }));

    render(<App doctorService={createDoctorService()} />);
    await user.click(screen.getByTestId('desktop__connect-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('https://agentsmith.example.com');
    });
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('Not signed in');
    expect(screen.getByTestId('desktop__sign-in')).toBeInTheDocument();
  });

  it('loads desktop auth config through the tauri backend when running in tauri', async () => {
    const user = userEvent.setup();
    (window as typeof window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValueOnce({
      deployment_base_url: 'http://localhost:3101',
      api_base_url: 'http://localhost:21000/api/v1',
      issuer: 'http://localhost:18080/realms/mbos',
      authorization_endpoint: 'http://localhost:18080/realms/mbos/protocol/openid-connect/auth',
      token_endpoint: 'http://localhost:18080/realms/mbos/protocol/openid-connect/token',
      client_id: 'agentsmith',
      scopes: ['openid', 'profile', 'email'],
      response_type: 'code',
      pkce_method: 'S256',
      suggested_callback_origin: 'http://127.0.0.1',
      suggested_callback_path: '/desktop/auth/callback',
    });

    render(<App doctorService={createDoctorService()} />);
    const input = screen.getByLabelText('Deployment URL');
    await user.clear(input);
    await user.type(input, 'http://localhost:3101');
    await user.click(screen.getByTestId('desktop__connect-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('http://localhost:3101');
    });
    expect(invokeMock).toHaveBeenCalledWith('fetch_desktop_auth_config', {
      deploymentBaseUrl: 'http://localhost:3101',
    });
  });

  it('completes sign-in through the interactive auth runtime and loads libraries', async () => {
    const user = userEvent.setup();
    const authRuntime: DesktopAuthRuntime = {
      startInteractiveSignIn: vi.fn().mockImplementation(async () => {
        const pkce = JSON.parse(window.sessionStorage.getItem('agentsmith-desktop:pkce') ?? '{}') as {
          state?: string;
        };
        return {
          code: 'code_123',
          state: pkce.state ?? null,
          error: null,
        };
      }),
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/public/desktop/auth')) {
        return new Response(JSON.stringify({
          deployment_base_url: 'https://agentsmith.example.com',
          api_base_url: API_BASE,
          issuer: 'https://agentsmith.example.com/realms/mbos',
          authorization_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/auth',
          token_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/token',
          client_id: 'agentsmith-desktop',
          scopes: ['openid', 'profile', 'email'],
          response_type: 'code',
          pkce_method: 'S256',
          suggested_callback_origin: 'http://127.0.0.1',
          suggested_callback_path: '/desktop/auth/callback',
        }), { status: 200 });
      }
      if (url.endsWith('/protocol/openid-connect/token') && init?.method === 'POST') {
        return new Response(JSON.stringify({
          access_token: [
            'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0',
            btoa(JSON.stringify({
              sub: 'user_1',
              email: 'user@example.com',
              name: 'User Example',
            })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
            '',
          ].join('.'),
          refresh_token: 'refresh_123',
          expires_in: 3600,
        }), { status: 200 });
      }
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });

    render(<App authRuntime={authRuntime} doctorService={createDoctorService()} />);
    await user.click(screen.getByTestId('desktop__connect-submit'));
    await user.click(await screen.findByTestId('desktop__sign-in'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('user@example.com');
    });
    expect(await screen.findByTestId('desktop__library--lib_2')).toBeInTheDocument();
    expect(authRuntime.startInteractiveSignIn).toHaveBeenCalled();
  });

  it('restores a signed-in session from local storage and toggles activation', async () => {
    const mountService: DesktopMountService = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_2',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_1',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Shared Docs',
              status: 'ready',
              created_at: '2026-04-01T10:00:00.000Z',
            },
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      if (url.endsWith('/api/v1/workspaces/ws_default/projects/proj_demo/file-libraries/lib_2/desktop-mount-access')) {
        return new Response(JSON.stringify({
          desktop_mount_access: {
            filesystem_name: 'fs_demo',
            metadata_url: 'postgres://demo',
            storage_bucket_url: 'http://minio.example/fs_demo',
            deployment_base_url: 'https://agentsmith.example.com',
            default_mount_roots: {
              linux: '/home/user/AgentSmith',
              macos: '/Users/user/AgentSmith',
              windows: 'X:',
            },
            windows_requires_drive_letter: true,
            created_at: '2026-04-01T12:30:00.000Z',
          },
        }), { status: 200 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: [],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));

    render(<App mountService={mountService} doctorService={createDoctorService()} />);
    const user = userEvent.setup();
    expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('https://agentsmith.example.com');
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('user@example.com');
    const libraries = await screen.findAllByTestId(/desktop__library--/);
    expect(libraries[0]).toHaveTextContent('Design Assets');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));
    await waitFor(() => {
      expect(screen.getByTestId('desktop__library-toggle--lib_2')).toHaveTextContent('Deactivate');
      expect(screen.getByTestId('desktop__library-mount-state--lib_2')).toHaveTextContent('active');
      expect(screen.getByTestId('desktop__library-mount-target--lib_2')).toHaveTextContent('/home/user/AgentSmith/ws_default/lib_2');
    });
    expect(mountService.activate).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'lib_2',
      workspaceId: 'ws_default',
    }));
    const aliasInput = screen.getByTestId('desktop__library-alias--lib_2');
    await user.type(aliasInput, 'Work Files');
    expect(aliasInput).toHaveValue('Work Files');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));
    await waitFor(() => {
      expect(screen.getByTestId('desktop__library-toggle--lib_2')).toHaveTextContent('Activate');
      expect(screen.getByTestId('desktop__library-mount-state--lib_2')).toHaveTextContent('idle');
    });
    expect(mountService.deactivate).toHaveBeenCalledWith('lib_2');
  });

  it('shows a failed mount state when desktop mount access exchange fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      if (url.endsWith('/api/v1/workspaces/ws_default/projects/proj_demo/file-libraries/lib_2/desktop-mount-access')) {
        return new Response('{}', { status: 404 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: [],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));

    render(<App doctorService={createDoctorService()} />);
    const user = userEvent.setup();
    await screen.findByTestId('desktop__library--lib_2');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__library-mount-state--lib_2')).toHaveTextContent('failed');
      expect(screen.getByTestId('desktop__diagnostics')).toHaveTextContent('desktop_mount_access_failed_404');
    });
  });

  it('blocks mount activation when doctor prerequisites are missing', async () => {
    const mountService: DesktopMountService = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_2',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: [],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));

    render(<App
      mountService={mountService}
      doctorService={createDoctorService([
        {
          key: 'juicefs',
          status: 'ready',
          detail: '/usr/bin/juicefs',
        },
        {
          key: 'fuse',
          status: 'missing',
          detail: '/dev/fuse_missing',
        },
      ])}
    />);

    const user = userEvent.setup();
    await screen.findByTestId('desktop__library--lib_2');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__library-mount-state--lib_2')).toHaveTextContent('failed');
      expect(screen.getByTestId('desktop__diagnostics')).toHaveTextContent(
        'desktop_mount_prerequisites_missing:fuse',
      );
    });
    expect(mountService.activate).not.toHaveBeenCalled();
  });

  it('signs out and clears the signed-in user', async () => {
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: [],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));
    const user = userEvent.setup();
    render(<App doctorService={createDoctorService()} />);
    await user.click(screen.getByTestId('desktop__sign-out'));
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('Not signed in');
    expect(window.localStorage.getItem('agentsmith-desktop:session')).toBeNull();
  });

  it('restores active libraries through the mount service after session recovery', async () => {
    const mountService: DesktopMountService = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_2',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      if (url.endsWith('/api/v1/workspaces/ws_default/projects/proj_demo/file-libraries/lib_2/desktop-mount-access')) {
        return new Response(JSON.stringify({
          desktop_mount_access: {
            filesystem_name: 'fs_demo',
            metadata_url: 'postgres://demo',
            storage_bucket_url: 'http://minio.example/fs_demo',
            deployment_base_url: 'https://agentsmith.example.com',
            default_mount_roots: {
              linux: '/home/user/AgentSmith',
              macos: '/Users/user/AgentSmith',
              windows: 'X:',
            },
            windows_requires_drive_letter: true,
            created_at: '2026-04-01T12:30:00.000Z',
          },
        }), { status: 200 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: ['lib_2'],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));

    render(<App mountService={mountService} doctorService={createDoctorService()} />);
    await waitFor(() => {
      expect(mountService.activate).toHaveBeenCalledWith(expect.objectContaining({
        libraryId: 'lib_2',
        workspaceId: 'ws_default',
      }));
    });
  });

  it('stops all mounts when the window unloads', async () => {
    const mountService: DesktopMountService = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_2',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };

    render(<App mountService={mountService} doctorService={createDoctorService()} />);
    window.dispatchEvent(new Event('beforeunload'));

    await waitFor(() => {
      expect(mountService.stopAll).toHaveBeenCalled();
    });
  });

  it('renders doctor checks from the configured doctor service', async () => {
    render(<App doctorService={createDoctorService([
      {
        key: 'juicefs',
        status: 'ready',
        detail: '/usr/bin/juicefs',
      },
      {
        key: 'fuse',
        status: 'missing',
        detail: '/dev/fuse_missing',
      },
    ])} />);

    expect(await screen.findByTestId('desktop__doctor')).toBeInTheDocument();
    expect(screen.getByTestId('desktop__doctor-check--juicefs')).toHaveTextContent('ready');
    expect(screen.getByTestId('desktop__doctor-check--fuse')).toHaveTextContent('missing');
  });

  it('shows doctor guidance for missing platform prerequisites', async () => {
    render(<App doctorService={createDoctorService([
      {
        key: 'juicefs',
        status: 'ready',
        detail: '/usr/bin/juicefs',
      },
      {
        key: 'fuse',
        status: 'missing',
        detail: '/dev/fuse_missing',
      },
    ])} />);

    expect(await screen.findByTestId('desktop__doctor-guidance')).toHaveTextContent(
      'Install FUSE support on this machine',
    );
  });

  it('refreshes doctor diagnostics on demand', async () => {
    const doctorService: DesktopDoctorService = {
      runChecks: vi.fn()
        .mockResolvedValueOnce([
          {
            key: 'juicefs',
            status: 'ready',
            detail: '/usr/bin/juicefs',
          },
          {
            key: 'fuse',
            status: 'missing',
            detail: '/dev/fuse_missing',
          },
        ])
        .mockResolvedValueOnce([
          {
            key: 'juicefs',
            status: 'ready',
            detail: '/usr/bin/juicefs',
          },
          {
            key: 'fuse',
            status: 'ready',
            detail: '/usr/bin/fusermount3',
          },
        ]),
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      handoffGuidanceAction: vi.fn().mockResolvedValue(undefined),
    };

    render(<App doctorService={doctorService} />);
    expect(await screen.findByTestId('desktop__doctor-check--fuse')).toHaveTextContent('missing');

    const user = userEvent.setup();
    await user.click(screen.getByTestId('desktop__doctor-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__doctor-check--fuse')).toHaveTextContent('ready');
    });
    expect(doctorService.runChecks).toHaveBeenCalledTimes(2);
  });

  it('opens the doctor setup guide for missing prerequisites', async () => {
    const doctorService: DesktopDoctorService = {
      runChecks: vi.fn().mockResolvedValue([
        {
          key: 'juicefs',
          status: 'ready',
          detail: '/usr/bin/juicefs',
        },
        {
          key: 'fuse',
          status: 'missing',
          detail: '/dev/fuse_missing',
        },
      ]),
      openExternalUrl: vi.fn().mockResolvedValue(undefined),
      handoffGuidanceAction: vi.fn().mockResolvedValue(undefined),
    };
    render(<App doctorService={doctorService} />);

    const user = userEvent.setup();
    await user.click(await screen.findByTestId('desktop__doctor-action--fuse'));

    expect(doctorService.handoffGuidanceAction).toHaveBeenCalledWith(expect.objectContaining({
      key: 'fuse',
      url: 'https://juicefs.com/docs/community/getting-started/installation/',
      installer_key: null,
    }));
  });

  it('opens an active mount target through the mount service', async () => {
    const mountService: DesktopMountService = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_2',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/me/desktop/file-libraries')) {
        return new Response(JSON.stringify({
          items: [
            {
              id: 'lib_2',
              workspace_id: 'ws_default',
              project_id: 'proj_demo',
              name: 'Design Assets',
              status: 'ready',
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        }), { status: 200 });
      }
      if (url.endsWith('/api/v1/workspaces/ws_default/projects/proj_demo/file-libraries/lib_2/desktop-mount-access')) {
        return new Response(JSON.stringify({
          desktop_mount_access: {
            filesystem_name: 'fs_demo',
            metadata_url: 'postgres://demo',
            storage_bucket_url: 'http://minio.example/fs_demo',
            deployment_base_url: 'https://agentsmith.example.com',
            default_mount_roots: {
              linux: '/home/user/AgentSmith',
              macos: '/Users/user/AgentSmith',
              windows: 'X:',
            },
            windows_requires_drive_letter: true,
            created_at: '2026-04-01T12:30:00.000Z',
          },
        }), { status: 200 });
      }
      throw new Error(`unexpected_fetch_${url}`);
    });
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
        deployment_base_url: 'https://agentsmith.example.com',
        api_base_url: API_BASE,
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
      active_library_ids: [],
      library_aliases: {},
      mount_states: {},
      diagnostics: {
        last_mount_error: null,
        checks: [],
      },
    }));

    render(<App mountService={mountService} doctorService={createDoctorService()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('desktop__library-toggle--lib_2'));
    await waitFor(() => {
      expect(screen.getByTestId('desktop__library-mount-target--lib_2')).toHaveTextContent('/home/user/AgentSmith/ws_default/lib_2');
    });

    await user.click(screen.getByTestId('desktop__library-open-target--lib_2'));

    expect(mountService.openPath).toHaveBeenCalledWith('/home/user/AgentSmith/ws_default/lib_2');
  });
});
