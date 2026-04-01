import { fetchDesktopMountAccess } from '../api';

describe('fetchDesktopMountAccess', () => {
  it('requests desktop mount access for a library', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
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
        created_at: '2026-04-01T10:00:00.000Z',
      },
    }), { status: 200 }));

    const access = await fetchDesktopMountAccess({
      apiBaseUrl: 'https://api.agentsmith.example.com/api/v1',
      authSession: {
        access_token: 'token_a',
        refresh_token: null,
        expires_at: null,
      },
      workspaceId: 'ws_default',
      projectId: 'proj_demo',
      libraryId: 'lib_demo',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.agentsmith.example.com/api/v1/workspaces/ws_default/projects/proj_demo/file-libraries/lib_demo/desktop-mount-access',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: 'Bearer token_a',
        },
      }),
    );
    expect(access.filesystem_name).toBe('fs_demo');
  });

  it('throws a typed error when access exchange fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 404 }));

    await expect(fetchDesktopMountAccess({
      apiBaseUrl: 'https://api.agentsmith.example.com/api/v1',
      authSession: {
        access_token: 'token_a',
        refresh_token: null,
        expires_at: null,
      },
      workspaceId: 'ws_default',
      projectId: 'proj_demo',
      libraryId: 'lib_demo',
      fetchImpl,
    })).rejects.toThrow('desktop_mount_access_failed_404');
  });
});
