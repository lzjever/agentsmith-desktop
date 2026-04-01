import type { DesktopDoctorCheck } from '../../types';
import type { DesktopPlatform } from '../mounts/paths';

export interface DesktopDoctorService {
  runChecks(): Promise<DesktopDoctorCheck[]>;
}

const REQUIRED_KEYS_BY_PLATFORM: Record<DesktopPlatform, string[]> = {
  linux: ['juicefs', 'fuse'],
  macos: ['juicefs', 'macfuse'],
  windows: ['juicefs', 'winfsp'],
};

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

export function getMissingDesktopMountPrerequisites(args: {
  checks: DesktopDoctorCheck[];
  platform: DesktopPlatform;
}): string[] {
  const readyKeys = new Set(
    args.checks
      .filter((check) => check.status === 'ready')
      .map((check) => check.key),
  );
  return REQUIRED_KEYS_BY_PLATFORM[args.platform].filter((key) => !readyKeys.has(key));
}

export function assertDesktopMountReady(args: {
  checks: DesktopDoctorCheck[];
  platform: DesktopPlatform;
}): void {
  const missing = getMissingDesktopMountPrerequisites(args);
  if (missing.length > 0) {
    throw new Error(`desktop_mount_prerequisites_missing:${missing.join(',')}`);
  }
}
