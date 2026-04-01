import type { FileLibraryDesktopMountAccess } from '../../types';
import { buildDesktopMountTarget, type DesktopPlatform } from './paths';

export interface DesktopMountActivationInput {
  libraryId: string;
  workspaceId: string;
  access: FileLibraryDesktopMountAccess;
}

export interface DesktopMountActivationResult {
  mountTarget: string;
}

export interface DesktopMountService {
  activate(input: DesktopMountActivationInput): Promise<DesktopMountActivationResult>;
  deactivate(libraryId: string): Promise<void>;
  stopAll(): Promise<void>;
}

export function createDesktopMountService(args: {
  platform: DesktopPlatform;
}): DesktopMountService {
  const activeMounts = new Map<string, string>();

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
      activeMounts.set(input.libraryId, mountTarget);
      return { mountTarget };
    },
    async deactivate(libraryId) {
      activeMounts.delete(libraryId);
    },
    async stopAll() {
      activeMounts.clear();
    },
  };
}
