import { invoke } from '@tauri-apps/api/core';
import type { DesktopDoctorCheck } from '../../types';
import type { DesktopDoctorGuidanceAction, DesktopDoctorService } from './service';

type InvokeFunction = typeof invoke;

export function createTauriDoctorService(
  invokeImpl: InvokeFunction = invoke,
): DesktopDoctorService {
  return {
    async runChecks(): Promise<DesktopDoctorCheck[]> {
      return invokeImpl<DesktopDoctorCheck[]>('run_doctor_checks');
    },
    async openExternalUrl(url: string): Promise<void> {
      await invokeImpl('open_external_url', { url });
    },
    async handoffGuidanceAction(action: DesktopDoctorGuidanceAction): Promise<void> {
      await invokeImpl('handoff_doctor_action', {
        actionKey: action.key,
        installerKey: action.installer_key,
        url: action.url,
      });
    },
  };
}
