import type { DesktopAuthSession, FileLibraryDesktopMountAccess } from '../../types';

export interface DesktopMountAccessFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface DesktopMountAccessExchangeResponse {
  desktop_mount_access: FileLibraryDesktopMountAccess;
}

export async function fetchDesktopMountAccess(args: {
  deploymentBaseUrl: string;
  authSession: DesktopAuthSession;
  workspaceId: string;
  projectId: string;
  libraryId: string;
  fetchImpl?: DesktopMountAccessFetch;
}): Promise<FileLibraryDesktopMountAccess> {
  const response = await (args.fetchImpl ?? fetch)(
    `${args.deploymentBaseUrl}/api/v1/workspaces/${args.workspaceId}/projects/${args.projectId}/file-libraries/${args.libraryId}/desktop-mount-access`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${args.authSession.access_token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`desktop_mount_access_failed_${response.status}`);
  }
  const payload = await response.json() as DesktopMountAccessExchangeResponse;
  return payload.desktop_mount_access;
}
