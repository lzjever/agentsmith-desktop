import type { DesktopLibrary, FileLibraryDesktopMountAccess } from '../../../types';
import { buildDesktopMountTarget, detectDesktopPlatform } from '../paths';

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

const LIBRARY: DesktopLibrary = {
  id: 'lib_demo',
  workspace_id: 'ws_default',
  project_id: 'proj_demo',
  name: 'Demo Library',
  created_at: '2026-04-01T11:00:00.000Z',
};

describe('buildDesktopMountTarget', () => {
  it('builds a unix directory target from workspace and library id', () => {
    expect(buildDesktopMountTarget({
      platform: 'linux',
      access: ACCESS,
      library: LIBRARY,
    })).toBe('/home/user/AgentSmith/ws_default/lib_demo');
  });

  it('uses the configured drive root on windows', () => {
    expect(buildDesktopMountTarget({
      platform: 'windows',
      access: ACCESS,
      library: LIBRARY,
    })).toBe('X:');
  });

  it('throws when the library does not include workspace context', () => {
    expect(() => buildDesktopMountTarget({
      platform: 'linux',
      access: ACCESS,
      library: {
        id: 'lib_demo',
        name: 'Demo Library',
        created_at: '2026-04-01T11:00:00.000Z',
      },
    })).toThrow('desktop_library_mount_context_missing');
  });
});

describe('detectDesktopPlatform', () => {
  it('maps windows-like navigator platforms to windows', () => {
    expect(detectDesktopPlatform('Win32')).toBe('windows');
  });

  it('maps mac-like navigator platforms to macos', () => {
    expect(detectDesktopPlatform('MacIntel')).toBe('macos');
  });

  it('falls back to linux', () => {
    expect(detectDesktopPlatform('Linux x86_64')).toBe('linux');
    expect(detectDesktopPlatform()).toBe('linux');
  });
});
