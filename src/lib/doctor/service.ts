import type { DesktopDoctorCheck } from '../../types';

export interface DesktopDoctorService {
  runChecks(): Promise<DesktopDoctorCheck[]>;
}

export function createFallbackDoctorService(): DesktopDoctorService {
  return {
    async runChecks() {
      return [
        {
          key: 'runtime',
          status: 'ready',
          detail: 'browser_fallback_runtime',
        },
      ];
    },
  };
}
