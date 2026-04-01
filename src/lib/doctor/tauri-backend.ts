import { invoke } from '@tauri-apps/api/core';
import type { DesktopDoctorCheck } from '../../types';
import type { DesktopDoctorService } from './service';

type InvokeFunction = typeof invoke;

export function createTauriDoctorService(
  invokeImpl: InvokeFunction = invoke,
): DesktopDoctorService {
  return {
    async runChecks(): Promise<DesktopDoctorCheck[]> {
      return invokeImpl<DesktopDoctorCheck[]>('run_doctor_checks');
    },
  };
}
