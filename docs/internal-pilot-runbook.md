# Internal Pilot Runbook

## Summary

Use this runbook for the first internal pilot release of AgentSmith Desktop.

Pilot goals:

- verify the desktop login flow against one AgentSmith deployment
- verify desktop library listing and local alias handling
- verify one successful mount lifecycle on each pilot machine
- verify restart restore and full-exit unmount behavior
- gather platform prerequisite failures and mount diagnostics

## Pilot Scope

Supported in this pilot:

- one AgentSmith deployment per running app session
- Windows, macOS, and Linux pilot packages
- Desktop-first file-library mounting
- manual shell mount remains available in the web UI for debugging only

Not part of this pilot:

- multiple deployments in one app session
- signed or notarized installers
- silent installation of every OS prerequisite
- VNC, local agent configuration, or non-files desktop workflows

## Preflight

Before handing a build to pilot users:

1. Confirm the GitHub release artifacts exist for all target platforms.
2. Confirm `docs/platform-prerequisites.md` matches the current runtime behavior.
3. Confirm the target AgentSmith deployment exposes:
   - `/api/public/desktop/auth`
   - `/api/v1/me/desktop/file-libraries`
   - desktop file-library mount access
4. Confirm the deployment returns client-visible mount truth, not runner/internal-only addresses.

## Pilot Validation Steps

For each pilot machine:

1. Install the Desktop build for that platform.
2. Launch the app and record the Doctor results.
3. Sign in to the target deployment.
4. Verify the libraries list loads and is sorted newest-first.
5. Activate one file library.
6. Confirm the mount target becomes visible locally.
7. Set a local alias and confirm it only affects Desktop display.
8. Restart the app and confirm the active mount is restored.
9. Fully exit the app and confirm the mount becomes unavailable.

## Failure Collection

When the pilot hits a failure, capture:

- platform and OS version
- Doctor checks shown in the Desktop UI
- last mount error
- whether the failure happened during sign-in, list load, mount, restore, or unmount
- the AgentSmith deployment URL used for the session

## Exit Criteria

The pilot can move to a wider rollout once:

- each target platform completes at least one successful mount lifecycle
- the Doctor surface explains missing prerequisites clearly
- no repeated restore loop or duplicate mount process issue remains
- pilot blockers all have tracked fixes or accepted limitations
