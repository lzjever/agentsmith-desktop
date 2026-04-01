import { createTauriMountBackend, isTauriRuntimeAvailable } from '../tauri-backend';

describe('createTauriMountBackend', () => {
  it('invokes mount, unmount, and stop-all commands', async () => {
    const invokeImpl = vi.fn()
      .mockResolvedValueOnce({
        library_id: 'lib_demo',
        state: 'Active',
        mount_target: '/home/user/AgentSmith/ws_default/lib_demo',
        last_error: null,
      })
      .mockResolvedValueOnce({
        library_id: 'lib_demo',
        state: 'Idle',
        mount_target: '/home/user/AgentSmith/ws_default/lib_demo',
        last_error: null,
      })
      .mockResolvedValueOnce([]);
    const backend = createTauriMountBackend(invokeImpl);

    const activated = await backend.activate({
      libraryId: 'lib_demo',
      workspaceId: 'ws_default',
      platform: 'linux',
      mountTarget: '/home/user/AgentSmith/ws_default/lib_demo',
      access: {
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
    });

    expect(activated.mountTarget).toBe('/home/user/AgentSmith/ws_default/lib_demo');
    expect(invokeImpl).toHaveBeenNthCalledWith(1, 'mount_library', {
      request: {
        libraryId: 'lib_demo',
        spec: {
          platform: 'Linux',
          filesystemName: 'fs_demo',
          metadataUrl: 'postgres://demo',
          mountTarget: '/home/user/AgentSmith/ws_default/lib_demo',
          storageBucketUrl: 'http://minio.example/fs_demo',
        },
      },
    });

    await backend.deactivate('lib_demo');
    expect(invokeImpl).toHaveBeenNthCalledWith(2, 'unmount_library', {
      libraryId: 'lib_demo',
    });

    await backend.stopAll();
    expect(invokeImpl).toHaveBeenNthCalledWith(3, 'stop_all_mounts');
  });

  it('invokes the tauri open-path command', async () => {
    const invokeImpl = vi.fn().mockResolvedValue(undefined);
    const backend = createTauriMountBackend(invokeImpl);

    await backend.openPath('/home/user/AgentSmith/ws_default/lib_demo');

    expect(invokeImpl).toHaveBeenCalledWith('open_path', {
      path: '/home/user/AgentSmith/ws_default/lib_demo',
    });
  });
});

describe('isTauriRuntimeAvailable', () => {
  it('detects tauri runtime globals', () => {
    const original = (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
    (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = {};
    expect(isTauriRuntimeAvailable()).toBe(true);
    if (original) {
      (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__ = original;
    } else {
      delete (window as Window & { __TAURI_INTERNALS__?: object }).__TAURI_INTERNALS__;
    }
  });
});
