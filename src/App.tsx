import * as React from 'react';
import type { DesktopLibrary, DesktopState } from './types';
import { buildLocalhostCallbackUrl, parseDesktopAuthCallbackUrl } from './lib/auth/callback';
import {
  buildSignedInUser,
  exchangeDesktopAuthorizationCode,
  fetchDesktopAuthConfig,
  startDesktopAuthorization,
} from './lib/auth/desktop-auth';
import {
  clearDesktopSession,
  clearPkceContext,
  loadDesktopSession,
  loadPkceContext,
  saveDesktopSession,
  savePkceContext,
} from './lib/auth/token-store';
import { normalizeDeploymentBaseUrl } from './lib/deployment/normalize';
import { displayLibraryName, sortLibrariesNewestFirst } from './lib/libraries/sort';
import {
  DEFAULT_DESKTOP_STATE,
  activateLibrary,
  completeDesktopSignIn,
  connectDeployment,
  deactivateLibrary,
  signOutDesktop,
} from './lib/state/desktop-state';

const DEMO_LIBRARIES: DesktopLibrary[] = sortLibrariesNewestFirst([
  { id: 'lib_1', name: 'Shared Docs', created_at: '2026-04-01T10:00:00.000Z' },
  { id: 'lib_2', name: 'Design Assets', created_at: '2026-04-01T12:00:00.000Z' },
]);

export function App() {
  const [state, setState] = React.useState<DesktopState>(DEFAULT_DESKTOP_STATE);
  const [deploymentInput, setDeploymentInput] = React.useState('https://agentsmith.example.com');
  const [status, setStatus] = React.useState<string>('idle');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const restored = loadDesktopSession(window.localStorage);
    if (restored) {
      setState({
        deployment_base_url: restored.deployment_base_url,
        auth_config: restored.auth_config,
        auth_session: restored.auth_session,
        signed_in_user: restored.signed_in_user,
        active_library_ids: restored.active_library_ids,
        library_aliases: restored.library_aliases,
      });
    }
  }, []);

  React.useEffect(() => {
    const callback = parseDesktopAuthCallbackUrl(window.location.href);
    const pkce = loadPkceContext(window.sessionStorage);
    if (!callback.code || !callback.state || callback.error || !pkce || !state.auth_config) {
      return;
    }
    if (pkce.state !== callback.state) {
      setError('desktop_state_mismatch');
      return;
    }
    setStatus('completing_sign_in');
    void exchangeDesktopAuthorizationCode({
      authConfig: state.auth_config,
      code: callback.code,
      verifier: pkce.verifier,
      callbackUrl: pkce.callback_url,
    }).then((session) => {
      const user = buildSignedInUser(session.access_token);
      setState((current) => {
        const next = completeDesktopSignIn(current, session, user);
        saveDesktopSession(window.localStorage, next);
        return next;
      });
      clearPkceContext(window.sessionStorage);
      window.history.replaceState({}, '', window.location.pathname);
      setStatus('signed_in');
      setError(null);
    }).catch((cause: unknown) => {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'desktop_login_failed');
    });
  }, [state.auth_config]);

  const handleConnect = React.useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);
      const normalizedBaseUrl = normalizeDeploymentBaseUrl(deploymentInput);
      const authConfig = await fetchDesktopAuthConfig(normalizedBaseUrl);
      setState((current) => connectDeployment(current, normalizedBaseUrl, authConfig));
      setStatus('connected');
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'desktop_connect_failed');
    }
  }, [deploymentInput]);

  const handleSignIn = React.useCallback(async () => {
    if (!state.auth_config || !state.deployment_base_url) {
      return;
    }
    const callbackUrl = buildLocalhostCallbackUrl(38111);
    const start = await startDesktopAuthorization({
      authConfig: state.auth_config,
      callbackUrl,
    });
    savePkceContext(window.sessionStorage, {
      deployment_base_url: state.deployment_base_url,
      state: start.state,
      verifier: start.verifier,
      callback_url: callbackUrl,
    });
    setStatus('awaiting_browser_sign_in');
    window.location.assign(start.authorizationUrl);
  }, [state.auth_config, state.deployment_base_url]);

  const handleSignOut = React.useCallback(() => {
    const next = signOutDesktop(state);
    clearDesktopSession(window.localStorage);
    clearPkceContext(window.sessionStorage);
    setState(next);
    setStatus('idle');
    setError(null);
  }, [state]);

  React.useEffect(() => {
    if (state.auth_session && state.signed_in_user) {
      saveDesktopSession(window.localStorage, state);
    }
  }, [state]);

  return (
    <main className="app-shell">
      <section className="panel" data-testid="desktop__session">
        <h1>AgentSmith Desktop</h1>
        <p className="muted">Single deployment companion app for local file-library mounts.</p>
        {!state.auth_config ? (
          <div className="connect-form" data-testid="desktop__connect">
            <label htmlFor="deployment-url">Deployment URL</label>
            <input
              id="deployment-url"
              value={deploymentInput}
              onChange={(event) => setDeploymentInput(event.currentTarget.value)}
              data-testid="desktop__deployment-input"
            />
            <button type="button" onClick={handleConnect} data-testid="desktop__connect-submit">Connect</button>
          </div>
        ) : (
          <>
            <div data-testid="desktop__deployment-url">{state.deployment_base_url}</div>
            <div data-testid="desktop__signed-in-user">{state.signed_in_user?.email ?? 'Not signed in'}</div>
            {state.signed_in_user ? (
              <button type="button" onClick={handleSignOut} data-testid="desktop__sign-out">Sign out</button>
            ) : (
              <button type="button" onClick={() => void handleSignIn()} data-testid="desktop__sign-in">
                Sign in with browser
              </button>
            )}
          </>
        )}
        <div className="muted" data-testid="desktop__status">{status}</div>
        {error ? <div data-testid="desktop__error">{error}</div> : null}
      </section>

      {state.signed_in_user ? (
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
      ) : null}
    </main>
  );
}
