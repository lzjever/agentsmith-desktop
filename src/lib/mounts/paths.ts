import type { DesktopLibrary, FileLibraryDesktopMountAccess } from '../../types';

export type DesktopPlatform = 'linux' | 'macos' | 'windows';

export function detectDesktopPlatform(platform = typeof navigator !== 'undefined' ? navigator.platform : undefined): DesktopPlatform {
  const normalized = (platform ?? '').toLowerCase();
  if (normalized.includes('win')) return 'windows';
  if (normalized.includes('mac')) return 'macos';
  return 'linux';
}

export function buildDesktopMountTarget(args: {
  platform: DesktopPlatform;
  access: FileLibraryDesktopMountAccess;
  library: DesktopLibrary;
}): string {
  if (args.platform === 'windows') {
    return args.access.default_mount_roots.windows;
  }
  if (!args.library.workspace_id) {
    throw new Error('desktop_library_mount_context_missing');
  }
  const root = args.platform === 'macos'
    ? args.access.default_mount_roots.macos
    : args.access.default_mount_roots.linux;
  return `${root}/${args.library.workspace_id}/${args.library.id}`;
}
