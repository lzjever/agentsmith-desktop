import type { DesktopAuthCallbackResult } from './callback';

export interface DesktopAuthRuntime {
  startInteractiveSignIn(args: {
    authorizationUrl: string;
    callbackUrl: string;
  }): Promise<DesktopAuthCallbackResult | null>;
}

