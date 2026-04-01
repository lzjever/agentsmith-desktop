# Release Checklist

## Before Tagging

- `npm test`
- `npm run typecheck`
- `npm run build`
- `cargo test`
- review `docs/known-limitations.md`
- review `docs/internal-pilot-runbook.md`
- confirm `README.md` and `docs/README.md` still describe Desktop-first behavior

## GitHub Release Requirements

- build workflow green on:
  - ubuntu-22.04
  - windows-latest
  - macos-latest
- release workflow prepared for `v*` tags
- artifacts uploaded for all three platforms
- checksums generated

## AgentSmith Web Coordination

- target deployment is running a build that includes:
  - desktop auth public route
  - desktop libraries route
  - desktop mount access route
  - Files Desktop-first UI
- `docs/user-guides/file-library-local-mount.md` in the main AgentSmith repo still treats manual mount as debug-only

## Pilot Readiness

- at least one supported machine per platform has run the pilot checklist
- one successful login -> list -> mount -> restore -> exit cycle has been recorded
- known limitations are documented for any platform-specific gaps
