# Known Limitations

## V1 Scope Limits

- only one AgentSmith deployment can be connected at a time
- switching deployments requires exiting and signing in again
- the app only handles file-library mounting in V1

## Platform Limits

- OS-level filesystem dependencies are still required:
  - Windows: `WinFsp`
  - macOS: `macFUSE`
  - Linux: FUSE support
- the internal pilot build does not yet require signed or notarized installers

## Runtime Limits

- mount availability is tied to the running Desktop app
- fully exiting the app stops or invalidates mounted libraries
- manual shell-based mount remains available in AgentSmith web only for advanced debugging

## Rollout Limits

- the first release is an internal pilot, not a public general-availability release
- packaging and install guidance are prioritized over silent system-level prerequisite installation
