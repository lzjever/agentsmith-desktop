import type { DesktopDoctorCheck } from '../../types';
import type { DesktopPlatform } from '../mounts/paths';

export interface DesktopDoctorService {
  runChecks(): Promise<DesktopDoctorCheck[]>;
  openExternalUrl(url: string): Promise<void>;
}

export interface DesktopDoctorGuidanceAction {
  key: string;
  message: string;
  url: string;
  label: string;
}

const REQUIRED_KEYS_BY_PLATFORM: Record<DesktopPlatform, string[]> = {
  linux: ['juicefs', 'fuse'],
  macos: ['juicefs', 'macfuse'],
  windows: ['juicefs', 'winfsp'],
};

const GUIDANCE_BY_KEY: Record<string, string> = {
  juicefs: 'Install or configure the JuiceFS binary for AgentSmith Desktop, then refresh diagnostics before mounting libraries.',
  fuse: 'Install FUSE support on this machine, then refresh diagnostics before mounting libraries.',
  macfuse: 'Install macFUSE on this machine, then refresh diagnostics before mounting libraries.',
  winfsp: 'Install WinFsp on this machine, then refresh diagnostics before mounting libraries.',
};

const GUIDANCE_URL_BY_KEY: Record<string, string> = {
  juicefs: 'https://juicefs.com/docs/community/getting-started/installation/',
  fuse: 'https://juicefs.com/docs/community/getting-started/installation/',
  macfuse: 'https://macfuse.github.io/',
  winfsp: 'https://winfsp.dev/rel/',
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
    async openExternalUrl(url: string) {
      window.open(url, '_blank', 'noopener,noreferrer');
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

export function getDesktopDoctorGuidance(args: {
  checks: DesktopDoctorCheck[];
  platform: DesktopPlatform;
}): string[] {
  return getMissingDesktopMountPrerequisites(args)
    .map((key) => GUIDANCE_BY_KEY[key] ?? `Install or configure ${key}, then refresh diagnostics before mounting libraries.`);
}

export function getDesktopDoctorGuidanceActions(args: {
  checks: DesktopDoctorCheck[];
  platform: DesktopPlatform;
}): DesktopDoctorGuidanceAction[] {
  return getMissingDesktopMountPrerequisites(args).map((key) => ({
    key,
    message: GUIDANCE_BY_KEY[key] ?? `Install or configure ${key}, then refresh diagnostics before mounting libraries.`,
    url: GUIDANCE_URL_BY_KEY[key] ?? 'https://juicefs.com/docs/community/getting-started/installation/',
    label: 'Open setup guide',
  }));
}
