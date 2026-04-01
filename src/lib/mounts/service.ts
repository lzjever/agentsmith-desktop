import type { FileLibraryDesktopMountAccess } from '../../types';
import { buildDesktopMountTarget, type DesktopPlatform } from './paths';

export interface DesktopMountBackendActivationInput {
  libraryId: string;
  workspaceId: string;
  platform: DesktopPlatform;
  mountTarget: string;
  access: FileLibraryDesktopMountAccess;
}

export interface DesktopMountBackendActivationResult {
  mountTarget: string;
}

export interface DesktopMountBackend {
  activate(input: DesktopMountBackendActivationInput): Promise<DesktopMountBackendActivationResult>;
  deactivate(libraryId: string): Promise<void>;
  stopAll(): Promise<void>;
  openPath(path: string): Promise<void>;
}

export interface DesktopMountService {
  activate(input: {
    libraryId: string;
    workspaceId: string;
    access: FileLibraryDesktopMountAccess;
  }): Promise<DesktopMountBackendActivationResult>;
  deactivate(libraryId: string): Promise<void>;
  stopAll(): Promise<void>;
  openPath(path: string): Promise<void>;
}

export function normalizeDesktopMountMetadataUrl(metadataUrl: string): string {
  try {
    const parsed = new URL(metadataUrl);
    if (parsed.protocol === 'postgres:' && parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
    return metadataUrl;
  } catch {
    return metadataUrl;
  }
}

export function createInMemoryMountBackend(args: {
  platform: DesktopPlatform;
}): DesktopMountBackend {
  const activeMounts = new Map<string, string>();

  return {
    async activate(input) {
      activeMounts.set(input.libraryId, input.mountTarget);
      return { mountTarget: input.mountTarget };
    },
    async deactivate(libraryId) {
      activeMounts.delete(libraryId);
    },
    async stopAll() {
      activeMounts.clear();
    },
    async openPath(_path: string) {
      return;
    },
  };
}

export function createDesktopMountService(args: {
  platform: DesktopPlatform;
  backend: DesktopMountBackend;
}): DesktopMountService {
  return {
    async activate(input) {
      const mountTarget = buildDesktopMountTarget({
        platform: args.platform,
        access: input.access,
        library: {
          id: input.libraryId,
          workspace_id: input.workspaceId,
          name: input.libraryId,
          created_at: input.access.created_at,
        },
      });
      return args.backend.activate({
        ...input,
        platform: args.platform,
        mountTarget,
        access: {
          ...input.access,
          metadata_url: normalizeDesktopMountMetadataUrl(input.access.metadata_url),
        },
      });
    },
    async deactivate(libraryId) {
      await args.backend.deactivate(libraryId);
    },
    async stopAll() {
      await args.backend.stopAll();
    },
    async openPath(path) {
      await args.backend.openPath(path);
    },
  };
}
