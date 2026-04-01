import type { DesktopLibrary, DesktopState } from '../../types';
import { sortLibrariesNewestFirst } from '../libraries/sort';

export function mergeDesktopLibraries(
  state: DesktopState,
  libraries: DesktopLibrary[],
): DesktopState {
  return {
    ...state,
    libraries: sortLibrariesNewestFirst(libraries),
  };
}
