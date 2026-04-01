import type { FileLibraryDesktopMountAccess } from '../../../types';
import { createDesktopMountService, createInMemoryMountBackend, type DesktopMountBackend } from '../service';

const ACCESS: FileLibraryDesktopMountAccess = {
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
};

describe('createDesktopMountService', () => {
  it('activates a mount and returns a mount target', async () => {
    const service = createDesktopMountService({
      platform: 'linux',
      backend: createInMemoryMountBackend({ platform: 'linux' }),
    });

    const result = await service.activate({
      libraryId: 'lib_demo',
      workspaceId: 'ws_default',
      access: ACCESS,
    });

    expect(result.mountTarget).toBe('/home/user/AgentSmith/ws_default/lib_demo');
  });

  it('deactivates a mount and clears its record', async () => {
    const service = createDesktopMountService({
      platform: 'linux',
      backend: createInMemoryMountBackend({ platform: 'linux' }),
    });
    await service.activate({
      libraryId: 'lib_demo',
      workspaceId: 'ws_default',
      access: ACCESS,
    });

    await expect(service.deactivate('lib_demo')).resolves.toBeUndefined();
  });

  it('stops all active mounts', async () => {
    const service = createDesktopMountService({
      platform: 'linux',
      backend: createInMemoryMountBackend({ platform: 'linux' }),
    });
    await service.activate({
      libraryId: 'lib_a',
      workspaceId: 'ws_default',
      access: ACCESS,
    });
    await service.activate({
      libraryId: 'lib_b',
      workspaceId: 'ws_default',
      access: ACCESS,
    });

    await expect(service.stopAll()).resolves.toBeUndefined();
  });

  it('fails activation when workspace context is missing', async () => {
    const service = createDesktopMountService({
      platform: 'linux',
      backend: createInMemoryMountBackend({ platform: 'linux' }),
    });

    await expect(service.activate({
      libraryId: 'lib_demo',
      workspaceId: '',
      access: ACCESS,
    })).rejects.toThrow('desktop_library_mount_context_missing');
  });

  it('opens a mount target through the backend', async () => {
    const backend: DesktopMountBackend = {
      activate: vi.fn().mockResolvedValue({
        mountTarget: '/home/user/AgentSmith/ws_default/lib_demo',
      }),
      deactivate: vi.fn().mockResolvedValue(undefined),
      stopAll: vi.fn().mockResolvedValue(undefined),
      openPath: vi.fn().mockResolvedValue(undefined),
    };
    const service = createDesktopMountService({
      platform: 'linux',
      backend,
    });

    await service.openPath('/home/user/AgentSmith/ws_default/lib_demo');

    expect(backend.openPath).toHaveBeenCalledWith('/home/user/AgentSmith/ws_default/lib_demo');
  });
});
