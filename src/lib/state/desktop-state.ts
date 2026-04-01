import type { DesktopState } from '../../types';

export const DEFAULT_DESKTOP_STATE: DesktopState = {
  deployment_base_url: null,
  auth_config: null,
  auth_session: null,
  signed_in_user: null,
  active_library_ids: [],
  library_aliases: {},
};

export function connectDeployment(
  state: DesktopState,
  deploymentBaseUrl: string,
  authConfig: DesktopState['auth_config'],
): DesktopState {
  return {
    ...state,
    deployment_base_url: deploymentBaseUrl,
    auth_config: authConfig,
  };
}

export function completeDesktopSignIn(
  state: DesktopState,
  authSession: DesktopState['auth_session'],
  signedInUser: DesktopState['signed_in_user'],
): DesktopState {
  return {
    ...state,
    auth_session: authSession,
    signed_in_user: signedInUser,
  };
}

export function signOutDesktop(state: DesktopState): DesktopState {
  return {
    ...DEFAULT_DESKTOP_STATE,
    deployment_base_url: state.deployment_base_url,
    auth_config: state.auth_config,
  };
}

export function activateLibrary(state: DesktopState, libraryId: string): DesktopState {
  if (state.active_library_ids.includes(libraryId)) return state;
  return {
    ...state,
    active_library_ids: [...state.active_library_ids, libraryId],
  };
}

export function deactivateLibrary(state: DesktopState, libraryId: string): DesktopState {
  return {
    ...state,
    active_library_ids: state.active_library_ids.filter((value) => value !== libraryId),
  };
}

export function setLibraryAlias(state: DesktopState, libraryId: string, alias: string): DesktopState {
  const next = alias.trim();
  if (!next) {
    const { [libraryId]: _, ...rest } = state.library_aliases;
    return {
      ...state,
      library_aliases: rest,
    };
  }
  return {
    ...state,
    library_aliases: {
      ...state.library_aliases,
      [libraryId]: next,
    },
  };
}

export function restoreActiveLibraries(state: DesktopState): string[] {
  return state.active_library_ids.slice();
}
