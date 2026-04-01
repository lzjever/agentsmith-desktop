import * as React from 'react';
import type { DesktopLibrary, DesktopState } from './types';
import { DEFAULT_DESKTOP_STATE, activateLibrary, deactivateLibrary } from './lib/state/desktop-state';
import { displayLibraryName, sortLibrariesNewestFirst } from './lib/libraries/sort';

const DEMO_LIBRARIES: DesktopLibrary[] = sortLibrariesNewestFirst([
  { id: 'lib_1', name: 'Shared Docs', created_at: '2026-04-01T10:00:00.000Z' },
  { id: 'lib_2', name: 'Design Assets', created_at: '2026-04-01T12:00:00.000Z' },
]);

export function App() {
  const [state, setState] = React.useState<DesktopState>({
    ...DEFAULT_DESKTOP_STATE,
    deployment_base_url: 'https://agentsmith.example.com',
    signed_in_user: {
      id: 'user_1',
      email: 'user@example.com',
      name: 'User Example',
    },
  });

  return (
    <main className="app-shell">
      <section className="panel" data-testid="desktop__session">
        <h1>AgentSmith Desktop</h1>
        <p className="muted">Single deployment companion app for local file-library mounts.</p>
        <div data-testid="desktop__deployment-url">{state.deployment_base_url}</div>
        <div data-testid="desktop__signed-in-user">{state.signed_in_user?.email}</div>
      </section>

      <section className="panel" data-testid="desktop__libraries">
        <h2>Libraries</h2>
        <div className="library-list">
          {DEMO_LIBRARIES.map((library) => {
            const active = state.active_library_ids.includes(library.id);
            return (
              <div className="library-item" key={library.id} data-testid={`desktop__library--${library.id}`}>
                <div className="library-meta">
                  <strong>{displayLibraryName({ ...library, alias: state.library_aliases[library.id] ?? null })}</strong>
                  <span className="muted">{library.created_at}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setState((current) => (active ? deactivateLibrary(current, library.id) : activateLibrary(current, library.id)))}
                  data-testid={`desktop__library-toggle--${library.id}`}
                >
                  {active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
