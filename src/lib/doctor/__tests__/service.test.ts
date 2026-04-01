import {
  assertDesktopMountReady,
  createFallbackDoctorService,
  getMissingDesktopMountPrerequisites,
} from '../service';

describe('createFallbackDoctorService', () => {
  it('returns a browser fallback runtime check', async () => {
    const service = createFallbackDoctorService();

    await expect(service.runChecks()).resolves.toEqual([
      {
        key: 'runtime',
        status: 'ready',
        detail: 'browser_fallback_runtime',
      },
    ]);
  });
});

describe('desktop doctor mount prerequisites', () => {
  it('reports missing linux mount prerequisites', () => {
    expect(getMissingDesktopMountPrerequisites({
      platform: 'linux',
      checks: [
        { key: 'juicefs', status: 'ready', detail: '/usr/bin/juicefs' },
      ],
    })).toEqual(['fuse']);
  });

  it('passes when all linux mount prerequisites are ready', () => {
    expect(() => assertDesktopMountReady({
      platform: 'linux',
      checks: [
        { key: 'juicefs', status: 'ready', detail: '/usr/bin/juicefs' },
        { key: 'fuse', status: 'ready', detail: '/usr/bin/fusermount3' },
      ],
    })).not.toThrow();
  });

  it('throws a mount-ready error when prerequisites are missing', () => {
    expect(() => assertDesktopMountReady({
      platform: 'windows',
      checks: [
        { key: 'juicefs', status: 'ready', detail: 'C:\\juicefs.exe' },
      ],
    })).toThrow('desktop_mount_prerequisites_missing:winfsp');
  });
});
