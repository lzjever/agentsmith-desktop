import { allocateDriveLetter } from '../drive-letters';

describe('allocateDriveLetter', () => {
  it('prefers the highest free drive letter', () => {
    expect(allocateDriveLetter(['X', 'Y', 'Z'])).toBe('W');
  });

  it('ignores lowercase input and reserved letters', () => {
    expect(allocateDriveLetter(['z', 'y'])).toBe('X');
  });

  it('returns null when no suitable letters remain', () => {
    const used = Array.from({ length: 23 }, (_, index) => String.fromCharCode('D'.charCodeAt(0) + index));
    expect(allocateDriveLetter(used)).toBeNull();
  });
});
