import type { DesktopState } from '../../../types';
import { mergeDesktopLibraries } from '../session';

const BASE_STATE: DesktopState = {
  deployment_base_url: 'https://agentsmith.example.com',
  auth_config: null,
  auth_session: null,
  signed_in_user: null,
  libraries: [],
  active_library_ids: [],
  library_aliases: {},
  mount_states: {},
  diagnostics: {
    last_mount_error: null,
    checks: [],
  },
};

describe('session state helpers', () => {
  it('stores libraries newest first', () => {
    const next = mergeDesktopLibraries(BASE_STATE, [
      { id: 'lib_old', name: 'Old', created_at: '2026-04-01T10:00:00.000Z' },
      { id: 'lib_new', name: 'New', created_at: '2026-04-01T12:00:00.000Z' },
    ]);
    expect(next.libraries.map((item) => item.id)).toEqual(['lib_new', 'lib_old']);
  });
});
