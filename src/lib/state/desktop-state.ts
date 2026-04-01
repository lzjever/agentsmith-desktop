import type { DesktopState } from '../../types';

export const DEFAULT_DESKTOP_STATE: DesktopState = {
  deployment_base_url: null,
  signed_in_user: null,
  active_library_ids: [],
  library_aliases: {},
};

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
