export interface DesktopLibrary {
  id: string;
  name: string;
  created_at: string;
  alias?: string | null;
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

export interface DesktopState {
  deployment_base_url: string | null;
  auth_config: DesktopAuthConfig | null;
  auth_session: DesktopAuthSession | null;
  signed_in_user: SignedInUser | null;
  active_library_ids: string[];
  library_aliases: Record<string, string>;
}
