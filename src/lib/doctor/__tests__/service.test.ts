import { createFallbackDoctorService } from '../service';

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
