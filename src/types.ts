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

export interface DesktopState {
  deployment_base_url: string | null;
  signed_in_user: SignedInUser | null;
  active_library_ids: string[];
  library_aliases: Record<string, string>;
}
