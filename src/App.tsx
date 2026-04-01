import * as React from 'react';
import type { DesktopLibrary, DesktopState } from './types';
import { buildLocalhostCallbackUrl, parseDesktopAuthCallbackUrl } from './lib/auth/callback';
import {
  buildSignedInUser,
  exchangeDesktopAuthorizationCode,
  fetchDesktopAuthConfig,
  startDesktopAuthorization,
} from './lib/auth/desktop-auth';
import { createBrowserAuthRuntime, createTauriAuthRuntime } from './lib/auth/tauri-backend';
import {
  clearDesktopSession,
  clearPkceContext,
  loadDesktopSession,
  loadPkceContext,
  saveDesktopSession,
  savePkceContext,
} from './lib/auth/token-store';
import type { DesktopAuthRuntime } from './lib/auth/runtime';
import { normalizeDeploymentBaseUrl } from './lib/deployment/normalize';
import {
  assertDesktopMountReady,
  createFallbackDoctorService,
  getDesktopDoctorGuidanceActions,
  type DesktopDoctorService,
} from './lib/doctor/service';
import { createTauriDoctorService } from './lib/doctor/tauri-backend';
import { fetchDesktopLibraries } from './lib/libraries/api';
import { displayLibraryName, sortLibrariesNewestFirst } from './lib/libraries/sort';
import { fetchDesktopMountAccess } from './lib/mounts/api';
import { buildDesktopMountTarget, detectDesktopPlatform } from './lib/mounts/paths';
import { createDesktopMountService, createInMemoryMountBackend, type DesktopMountService } from './lib/mounts/service';
import { createTauriMountBackend, isTauriRuntimeAvailable } from './lib/mounts/tauri-backend';
import {
  DEFAULT_DESKTOP_STATE,
  activateLibrary,
  completeDesktopSignIn,
  connectDeployment,
  deactivateLibrary,
  markLibraryMounted,
  markLibraryMountFailed,
  markLibraryUnmounted,
  setLibraryAlias,
  signOutDesktop,
} from './lib/state/desktop-state';
import { mergeDesktopLibraries } from './lib/state/session';

export function App(props: {
  mountService?: DesktopMountService;
  doctorService?: DesktopDoctorService;
  authRuntime?: DesktopAuthRuntime;
} = {}) {
  const [state, setState] = React.useState<DesktopState>(DEFAULT_DESKTOP_STATE);
  const [deploymentInput, setDeploymentInput] = React.useState('https://agentsmith.example.com');
  const platform = React.useMemo(() => detectDesktopPlatform(), []);
  const [status, setStatus] = React.useState<string>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const mountService = React.useMemo(
    () => props.mountService ?? createDesktopMountService({
      platform,
      backend: isTauriRuntimeAvailable()
        ? createTauriMountBackend()
        : createInMemoryMountBackend({ platform }),
    }),
    [platform, props.mountService],
  );
  const doctorService = React.useMemo(
    () => props.doctorService ?? (
      isTauriRuntimeAvailable()
        ? createTauriDoctorService()
        : createFallbackDoctorService()
    ),
    [props.doctorService],
  );
  const authRuntime = React.useMemo(
    () => props.authRuntime ?? (
      isTauriRuntimeAvailable()
        ? createTauriAuthRuntime()
        : createBrowserAuthRuntime()
    ),
    [props.authRuntime],
  );

  React.useEffect(() => {
    const restored = loadDesktopSession(window.localStorage);
    if (restored) {
      setState({
        deployment_base_url: restored.deployment_base_url,
        auth_config: restored.auth_config,
        auth_session: restored.auth_session,
        signed_in_user: restored.signed_in_user,
        libraries: [],
        active_library_ids: restored.active_library_ids,
        library_aliases: restored.library_aliases,
        mount_states: {},
        diagnostics: {
          last_mount_error: null,
          checks: [],
        },
      });
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const runDoctorChecks = async () => {
      try {
        const checks = await doctorService.runChecks();
        if (cancelled) return;
        setState((current) => ({
          ...current,
          diagnostics: {
            ...current.diagnostics,
            checks,
          },
        }));
      } catch (cause: unknown) {
        if (cancelled) return;
        setState((current) => ({
          ...current,
          diagnostics: {
            ...current.diagnostics,
            checks: [
              {
                key: 'doctor',
                status: 'missing',
                detail: cause instanceof Error ? cause.message : 'desktop_doctor_failed',
              },
            ],
          },
        }));
      }
    };
    void runDoctorChecks();
    return () => {
      cancelled = true;
    };
  }, [doctorService]);

  const refreshDoctorChecks = React.useCallback(async () => {
    try {
      const checks = await doctorService.runChecks();
      setState((current) => ({
        ...current,
        diagnostics: {
          ...current.diagnostics,
          checks,
        },
      }));
    } catch (cause: unknown) {
      setState((current) => ({
        ...current,
        diagnostics: {
          ...current.diagnostics,
          checks: [
            {
              key: 'doctor',
              status: 'missing',
              detail: cause instanceof Error ? cause.message : 'desktop_doctor_failed',
            },
          ],
        },
      }));
    }
  }, [doctorService]);

  const doctorGuidanceActions = React.useMemo(() => getDesktopDoctorGuidanceActions({
    checks: state.diagnostics.checks,
    platform,
  }), [platform, state.diagnostics.checks]);

  const completeSignInFromCallback = React.useCallback(async (callback: ReturnType<typeof parseDesktopAuthCallbackUrl>) => {
    const pkce = loadPkceContext(window.sessionStorage);
    if (!callback.code || !callback.state || !pkce || !state.auth_config) {
      if (callback.error) {
        setStatus('error');
        setError(callback.error);
      }
      return;
    }
    if (pkce.state !== callback.state) {
      setError('desktop_state_mismatch');
      setStatus('error');
      return;
    }
    setStatus('completing_sign_in');
    try {
      const session = await exchangeDesktopAuthorizationCode({
        authConfig: state.auth_config,
        code: callback.code,
        verifier: pkce.verifier,
        callbackUrl: pkce.callback_url,
      });
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
    } catch (cause: unknown) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'desktop_login_failed');
    }
  }, [state.auth_config]);

  React.useEffect(() => {
    const callback = parseDesktopAuthCallbackUrl(window.location.href);
    if (!callback.code && !callback.error) {
      return;
    }
    void completeSignInFromCallback(callback);
  }, [completeSignInFromCallback]);

  React.useEffect(() => {
    if (!state.auth_session || !state.deployment_base_url || !state.auth_config) {
      return;
    }
    let cancelled = false;
    void fetchDesktopLibraries({
      apiBaseUrl: state.auth_config.api_base_url ?? state.deployment_base_url,
      authSession: state.auth_session,
    }).then((libraries) => {
      if (cancelled) return;
      setState((current) => mergeDesktopLibraries(current, libraries));
    }).catch((cause: unknown) => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'desktop_libraries_failed');
    });
    return () => {
      cancelled = true;
    };
  }, [state.auth_config, state.auth_session, state.deployment_base_url]);

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
    const callback = await authRuntime.startInteractiveSignIn({
      authorizationUrl: start.authorizationUrl,
      callbackUrl,
    });
    if (callback) {
      await completeSignInFromCallback(callback);
    }
  }, [authRuntime, completeSignInFromCallback, state.auth_config, state.deployment_base_url]);

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

  const handleActivateLibrary = React.useCallback(async (library: DesktopLibrary) => {
    if (!state.auth_session || !state.deployment_base_url || !state.auth_config || !library.workspace_id || !library.project_id) {
      setState((current) => markLibraryMountFailed(current, library.id, 'desktop_library_mount_context_missing'));
      return;
    }
    setState((current) => activateLibrary(current, library.id));
    try {
      const checks = state.diagnostics.checks.length > 0
        ? state.diagnostics.checks
        : await doctorService.runChecks();
      setState((current) => ({
        ...current,
        diagnostics: {
          ...current.diagnostics,
          checks,
        },
      }));
      assertDesktopMountReady({
        checks,
        platform,
      });
      const access = await fetchDesktopMountAccess({
        apiBaseUrl: state.auth_config.api_base_url ?? state.deployment_base_url,
        authSession: state.auth_session,
        workspaceId: library.workspace_id,
        projectId: library.project_id,
        libraryId: library.id,
      });
      const mountTarget = buildDesktopMountTarget({
        platform,
        access,
        library,
      });
      const activation = await mountService.activate({
        libraryId: library.id,
        workspaceId: library.workspace_id,
        access,
      });
      setState((current) => markLibraryMounted(current, library.id, activation.mountTarget || mountTarget));
    } catch (cause) {
      setState((current) => markLibraryMountFailed(
        current,
        library.id,
        cause instanceof Error ? cause.message : 'desktop_mount_failed',
      ));
    }
  }, [doctorService, mountService, platform, state.auth_session, state.deployment_base_url, state.diagnostics.checks]);

  const handleDeactivateLibrary = React.useCallback(async (libraryId: string) => {
    setState((current) => deactivateLibrary(current, libraryId));
    try {
      await mountService.deactivate(libraryId);
      setState((current) => markLibraryUnmounted(current, libraryId));
    } catch (cause) {
      setState((current) => markLibraryMountFailed(
        current,
        libraryId,
        cause instanceof Error ? cause.message : 'desktop_unmount_failed',
      ));
    }
  }, [mountService]);

  React.useEffect(() => {
    if (!state.auth_session || state.libraries.length === 0 || state.active_library_ids.length === 0) {
      return;
    }
    const restorableLibraries = state.libraries.filter((library) => {
      if (!state.active_library_ids.includes(library.id)) return false;
      const lifecycle = state.mount_states[library.id]?.state;
      return lifecycle !== 'active' && lifecycle !== 'activating';
    });
    if (restorableLibraries.length === 0) {
      return;
    }
    void Promise.all(restorableLibraries.map(async (library) => {
      await handleActivateLibrary(library);
    }));
  }, [handleActivateLibrary, state.active_library_ids, state.auth_session, state.libraries, state.mount_states]);

  React.useEffect(() => {
    const handleBeforeUnload = () => {
      void mountService.stopAll();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      void mountService.stopAll();
    };
  }, [mountService]);

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
        <div className="doctor-list" data-testid="desktop__doctor">
          <button type="button" onClick={() => void refreshDoctorChecks()} data-testid="desktop__doctor-refresh">
            Refresh diagnostics
          </button>
          {state.diagnostics.checks.map((check) => (
            <div key={check.key} data-testid={`desktop__doctor-check--${check.key}`}>
              <strong>{check.key}</strong>
              <span className="muted">{check.status}</span>
              <span className="muted">{check.detail}</span>
            </div>
          ))}
          {doctorGuidanceActions.length > 0 ? (
            <div data-testid="desktop__doctor-guidance">
              {doctorGuidanceActions.map((guidance) => (
                <div key={guidance.key} className="muted">
                  <div>{guidance.message}</div>
                    <button
                      type="button"
                      data-testid={`desktop__doctor-action--${guidance.key}`}
                      onClick={() => void doctorService.handoffGuidanceAction(guidance)}
                    >
                      {guidance.label}
                    </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {state.signed_in_user ? (
        <section className="panel" data-testid="desktop__libraries">
          <h2>Libraries</h2>
          <div className="library-list">
            {state.libraries.map((library) => {
              const active = state.active_library_ids.includes(library.id);
              const mountStatus = state.mount_states[library.id]?.state ?? 'idle';
              const mountTarget = state.mount_states[library.id]?.mount_target ?? null;
              return (
                <div className="library-item" key={library.id} data-testid={`desktop__library--${library.id}`}>
                  <div className="library-meta">
                    <strong>{displayLibraryName({ ...library, alias: state.library_aliases[library.id] ?? null })}</strong>
                    <span className="muted">{library.created_at}</span>
                    <span className="muted" data-testid={`desktop__library-mount-state--${library.id}`}>{mountStatus}</span>
                    {mountTarget ? (
                      <>
                        <span className="muted" data-testid={`desktop__library-mount-target--${library.id}`}>{mountTarget}</span>
                        <button
                          type="button"
                          data-testid={`desktop__library-open-target--${library.id}`}
                          onClick={() => void mountService.openPath(mountTarget)}
                        >
                          Open local folder
                        </button>
                      </>
                    ) : null}
                    <input
                      type="text"
                      value={state.library_aliases[library.id] ?? ''}
                      onChange={(event) => {
                        const nextAlias = event.currentTarget.value;
                        setState((current) => setLibraryAlias(current, library.id, nextAlias));
                      }}
                      placeholder="Local alias"
                      data-testid={`desktop__library-alias--${library.id}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (active) {
                        void handleDeactivateLibrary(library.id);
                      } else {
                        void handleActivateLibrary(library);
                      }
                    }}
                    data-testid={`desktop__library-toggle--${library.id}`}
                  >
                    {active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              );
            })}
          </div>
          {state.diagnostics.last_mount_error ? (
            <div className="muted" data-testid="desktop__diagnostics">{state.diagnostics.last_mount_error}</div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
