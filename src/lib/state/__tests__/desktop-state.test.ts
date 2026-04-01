import {
  DEFAULT_DESKTOP_STATE,
  activateLibrary,
  deactivateLibrary,
  restoreActiveLibraries,
  setLibraryAlias,
} from '../desktop-state';

describe('desktop state', () => {
  it('activates and restores libraries', () => {
    const active = activateLibrary(DEFAULT_DESKTOP_STATE, 'lib_1');
    expect(restoreActiveLibraries(active)).toEqual(['lib_1']);
  });

  it('deactivates libraries cleanly', () => {
    const active = activateLibrary(DEFAULT_DESKTOP_STATE, 'lib_1');
    expect(deactivateLibrary(active, 'lib_1').active_library_ids).toEqual([]);
  });

  it('stores and removes aliases', () => {
    const aliased = setLibraryAlias(DEFAULT_DESKTOP_STATE, 'lib_1', 'Work Files');
    expect(aliased.library_aliases.lib_1).toBe('Work Files');
    expect(setLibraryAlias(aliased, 'lib_1', '   ').library_aliases.lib_1).toBeUndefined();
  });
});
