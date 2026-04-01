import { invoke } from '@tauri-apps/api/core';
import type { DesktopAuthConfig } from '../../types';
import type { DesktopAuthCallbackResult } from './callback';
import type { DesktopAuthRuntime } from './runtime';

type InvokeFunction = typeof invoke;

function parseCallbackUrl(callbackUrl: string): { port: number; path: string } {
  const url = new URL(callbackUrl);
  const port = Number.parseInt(url.port, 10);
  if (!Number.isFinite(port)) {
    throw new Error('desktop_callback_port_missing');
  }
  return {
    port,
    path: url.pathname || '/',
  };
}

export function createTauriAuthRuntime(
  invokeImpl: InvokeFunction = invoke,
): DesktopAuthRuntime {
  return {
    async startInteractiveSignIn(args): Promise<DesktopAuthCallbackResult> {
      const callbackTarget = parseCallbackUrl(args.callbackUrl);
      const callbackPromise = invokeImpl<DesktopAuthCallbackResult>('await_auth_callback', callbackTarget);
      await invokeImpl('open_external_url', { url: args.authorizationUrl });
      return callbackPromise;
    },
  };
}

export async function fetchDesktopAuthConfigViaTauri(
  deploymentBaseUrl: string,
  invokeImpl: InvokeFunction = invoke,
): Promise<DesktopAuthConfig> {
  return invokeImpl<DesktopAuthConfig>('fetch_desktop_auth_config', {
    deploymentBaseUrl,
  });
}

export function createBrowserAuthRuntime(
  locationAssign: (url: string) => void = (url) => window.location.assign(url),
): DesktopAuthRuntime {
  return {
    async startInteractiveSignIn(args): Promise<null> {
      locationAssign(args.authorizationUrl);
      return null;
    },
  };
}
