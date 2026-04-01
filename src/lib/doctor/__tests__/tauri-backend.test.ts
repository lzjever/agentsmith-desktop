import { createTauriDoctorService } from '../tauri-backend';

describe('createTauriDoctorService', () => {
  it('invokes the tauri doctor command', async () => {
    const invokeImpl = vi.fn().mockResolvedValue([
      {
        key: 'juicefs',
        status: 'ready',
        detail: '/usr/bin/juicefs',
      },
    ]);

    const service = createTauriDoctorService(invokeImpl);
    const checks = await service.runChecks();

    expect(invokeImpl).toHaveBeenCalledWith('run_doctor_checks');
    expect(checks[0]).toEqual({
      key: 'juicefs',
      status: 'ready',
      detail: '/usr/bin/juicefs',
    });
  });

  it('invokes the tauri external opener command', async () => {
    const invokeImpl = vi.fn().mockResolvedValue(undefined);
    const service = createTauriDoctorService(invokeImpl);

    await service.openExternalUrl('https://winfsp.dev/rel/');

    expect(invokeImpl).toHaveBeenCalledWith('open_external_url', {
      url: 'https://winfsp.dev/rel/',
    });
  });

  it('invokes the tauri doctor handoff command', async () => {
    const invokeImpl = vi.fn().mockResolvedValue(undefined);
    const service = createTauriDoctorService(invokeImpl);

    await service.handoffGuidanceAction({
      key: 'winfsp',
      message: 'Install WinFsp on this machine, then refresh diagnostics before mounting libraries.',
      url: 'https://winfsp.dev/rel/',
      label: 'Open installer',
      installer_key: 'winfsp',
    });

    expect(invokeImpl).toHaveBeenCalledWith('handoff_doctor_action', {
      actionKey: 'winfsp',
      installerKey: 'winfsp',
      url: 'https://winfsp.dev/rel/',
    });
  });
});
