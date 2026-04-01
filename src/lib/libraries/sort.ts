import type { DesktopLibrary } from '../../types';

export function sortLibrariesNewestFirst(libraries: DesktopLibrary[]): DesktopLibrary[] {
  return libraries.slice().sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function displayLibraryName(library: DesktopLibrary): string {
  return library.alias?.trim() ? library.alias.trim() : library.name;
}
