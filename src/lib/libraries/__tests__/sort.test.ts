import { displayLibraryName, sortLibrariesNewestFirst } from '../sort';

describe('library sorting', () => {
  it('sorts newest libraries first', () => {
    const sorted = sortLibrariesNewestFirst([
      { id: 'old', name: 'Old', created_at: '2026-04-01T10:00:00.000Z' },
      { id: 'new', name: 'New', created_at: '2026-04-01T12:00:00.000Z' },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['new', 'old']);
  });

  it('prefers local alias for display', () => {
    expect(displayLibraryName({
      id: 'lib_1',
      name: 'Shared Docs',
      alias: 'Work Files',
      created_at: '2026-04-01T10:00:00.000Z',
    })).toBe('Work Files');
  });
});
