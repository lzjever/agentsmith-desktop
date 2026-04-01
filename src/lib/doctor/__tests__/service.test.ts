import {
  assertDesktopMountReady,
  createFallbackDoctorService,
  getDesktopDoctorGuidance,
  getDesktopDoctorGuidanceActions,
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

  it('returns linux guidance for missing fuse', () => {
    expect(getDesktopDoctorGuidance({
      platform: 'linux',
      checks: [
        { key: 'juicefs', status: 'ready', detail: '/usr/bin/juicefs' },
      ],
    })).toEqual([
      'Install FUSE support on this machine, then refresh diagnostics before mounting libraries.',
    ]);
  });

  it('returns windows guidance for missing winfsp', () => {
    expect(getDesktopDoctorGuidance({
      platform: 'windows',
      checks: [
        { key: 'juicefs', status: 'ready', detail: 'C:\\juicefs.exe' },
      ],
    })).toEqual([
      'Install WinFsp on this machine, then refresh diagnostics before mounting libraries.',
    ]);
  });

  it('returns no guidance when mount prerequisites are satisfied', () => {
    expect(getDesktopDoctorGuidance({
      platform: 'macos',
      checks: [
        { key: 'juicefs', status: 'ready', detail: '/Applications/AgentSmith Desktop/juicefs' },
        { key: 'macfuse', status: 'ready', detail: 'macFUSE 4.x' },
      ],
    })).toEqual([]);
  });

  it('returns action metadata for missing platform prerequisites', () => {
    expect(getDesktopDoctorGuidanceActions({
      platform: 'windows',
      checks: [
        { key: 'juicefs', status: 'ready', detail: 'C:\\juicefs.exe' },
      ],
    })).toEqual([
      {
        key: 'winfsp',
        message: 'Install WinFsp on this machine, then refresh diagnostics before mounting libraries.',
        url: 'https://winfsp.dev/rel/',
        label: 'Open installer',
        installer_key: 'winfsp',
      },
    ]);
  });
});
