import { invoke } from '@tauri-apps/api/core';
import type { DesktopAuthConfig } from '../../types';
import type { DesktopAuthRuntime } from './runtime';

type InvokeFunction = typeof invoke;

export function createTauriAuthRuntime(
  invokeImpl: InvokeFunction = invoke,
): DesktopAuthRuntime {
  return {
    async startInteractiveSignIn(args): Promise<void> {
      await invokeImpl('open_external_url', { url: args.authorizationUrl });
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
    async startInteractiveSignIn(args): Promise<void> {
      locationAssign(args.authorizationUrl);
    },
  };
}
