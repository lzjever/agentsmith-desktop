import type { DesktopState } from '../../types';

export const DEFAULT_DESKTOP_STATE: DesktopState = {
  deployment_base_url: null,
  auth_config: null,
  auth_session: null,
  signed_in_user: null,
  libraries: [],
  active_library_ids: [],
  library_aliases: {},
  mount_states: {},
  diagnostics: {
    last_mount_error: null,
  },
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
    mount_states: {
      ...state.mount_states,
      [libraryId]: {
        state: 'activating',
        mount_target: state.mount_states[libraryId]?.mount_target ?? null,
        last_error: null,
      },
    },
  };
}

export function deactivateLibrary(state: DesktopState, libraryId: string): DesktopState {
  return {
    ...state,
    active_library_ids: state.active_library_ids.filter((value) => value !== libraryId),
    mount_states: {
      ...state.mount_states,
      [libraryId]: {
        state: 'deactivating',
        mount_target: state.mount_states[libraryId]?.mount_target ?? null,
        last_error: state.mount_states[libraryId]?.last_error ?? null,
      },
    },
  };
}

export function markLibraryMounted(
  state: DesktopState,
  libraryId: string,
  mountTarget: string,
): DesktopState {
  return {
    ...state,
    mount_states: {
      ...state.mount_states,
      [libraryId]: {
        state: 'active',
        mount_target: mountTarget,
        last_error: null,
      },
    },
  };
}

export function markLibraryMountFailed(
  state: DesktopState,
  libraryId: string,
  error: string,
): DesktopState {
  return {
    ...state,
    mount_states: {
      ...state.mount_states,
      [libraryId]: {
        state: 'failed',
        mount_target: state.mount_states[libraryId]?.mount_target ?? null,
        last_error: error,
      },
    },
    diagnostics: {
      ...state.diagnostics,
      last_mount_error: error,
    },
  };
}

export function setLibraryAlias(state: DesktopState, libraryId: string, alias: string): DesktopState {
  if (!alias.trim()) {
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
      [libraryId]: alias,
      },
    };
}

export function restoreActiveLibraries(state: DesktopState): string[] {
  return state.active_library_ids.slice();
}
