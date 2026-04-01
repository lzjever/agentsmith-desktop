export interface DesktopLibrary {
  id: string;
  name: string;
  workspace_id?: string;
  project_id?: string;
  status?: string;
  created_at: string;
  alias?: string | null;
}

export interface FileLibraryDesktopMountAccess {
  filesystem_name: string;
  metadata_url: string;
  storage_bucket_url?: string;
  deployment_base_url: string;
  default_mount_roots: {
    linux: string;
    macos: string;
    windows: string;
  };
  windows_requires_drive_letter: boolean;
  created_at: string;
}

export interface SignedInUser {
  id: string;
  email: string;
  name: string;
}

export interface DesktopAuthConfig {
  deployment_base_url: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  client_id: string;
  scopes: string[];
  response_type: 'code';
  pkce_method: 'S256';
  suggested_callback_origin: string;
  suggested_callback_path: string;
}

export interface DesktopAuthSession {
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;
}

export interface DesktopPkceContext {
  deployment_base_url: string;
  state: string;
  verifier: string;
  callback_url: string;
}

export type DesktopMountLifecycleState =
  | 'idle'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'failed';

export interface DesktopMountStatus {
  state: DesktopMountLifecycleState;
  mount_target: string | null;
  last_error: string | null;
}

export type DesktopDoctorCheckStatus = 'ready' | 'missing';

export interface DesktopDoctorCheck {
  key: string;
  status: DesktopDoctorCheckStatus;
  detail: string;
}

export interface DesktopState {
  deployment_base_url: string | null;
  auth_config: DesktopAuthConfig | null;
  auth_session: DesktopAuthSession | null;
  signed_in_user: SignedInUser | null;
  libraries: DesktopLibrary[];
  active_library_ids: string[];
  library_aliases: Record<string, string>;
  mount_states: Record<string, DesktopMountStatus>;
  diagnostics: {
    last_mount_error: string | null;
    checks: DesktopDoctorCheck[];
  };
}
