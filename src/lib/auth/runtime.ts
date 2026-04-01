export interface DesktopAuthRuntime {
  startInteractiveSignIn(args: {
    authorizationUrl: string;
  }): Promise<void>;
}
