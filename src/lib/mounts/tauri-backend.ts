import { invoke } from '@tauri-apps/api/core';
import type { DesktopPlatform } from './paths';
import type {
  DesktopMountBackend,
  DesktopMountBackendActivationInput,
  DesktopMountBackendActivationResult,
} from './service';

type InvokeFunction = typeof invoke;

function toRustPlatform(platform: DesktopPlatform): 'Linux' | 'Macos' | 'Windows' {
  switch (platform) {
    case 'macos':
      return 'Macos';
    case 'windows':
      return 'Windows';
    default:
      return 'Linux';
  }
}

export function isTauriRuntimeAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createTauriMountBackend(
  invokeImpl: InvokeFunction = invoke,
): DesktopMountBackend {
  return {
    async activate(input: DesktopMountBackendActivationInput): Promise<DesktopMountBackendActivationResult> {
      const result = await invokeImpl<{
        library_id: string;
        state: string;
        mount_target: string | null;
        last_error: string | null;
      }>('mount_library', {
        request: {
          libraryId: input.libraryId,
          spec: {
            platform: toRustPlatform(input.platform),
            filesystemName: input.access.filesystem_name,
            metadataUrl: input.access.metadata_url,
            mountTarget: input.mountTarget,
            storageBucketUrl: input.access.storage_bucket_url ?? null,
          },
        },
      });
      if (!result.mount_target) {
        throw new Error('desktop_mount_target_missing');
      }
      return {
        mountTarget: result.mount_target,
      };
    },
    async deactivate(libraryId: string): Promise<void> {
      await invokeImpl('unmount_library', { libraryId });
    },
    async stopAll(): Promise<void> {
      await invokeImpl('stop_all_mounts');
    },
    async openPath(path: string): Promise<void> {
      await invokeImpl('open_path', { path });
    },
  };
}
