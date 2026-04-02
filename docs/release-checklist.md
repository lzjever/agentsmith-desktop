# Release Checklist

## Before Tagging

- `npm test`
- `npm run typecheck`
- `npm run build`
- `cargo test`
- `npm run smoke:local-manual-mount`
- confirm release workflows are green on the latest `main`
- do not build AppImage locally; AppImage, `.deb`, `.rpm`, and desktop installers are produced only by GitHub Actions after tagging
- review `docs/known-limitations.md`
- review `docs/internal-pilot-runbook.md`
- review `docs/internal-pilot-release-evidence.md`
- confirm `README.md` and `docs/README.md` still describe Desktop-first behavior
- confirm bundled prerequisite installers are present when required for the pilot:
  - `src-tauri/resources/installers/windows/WinFsp.msi` or `WinFsp.exe`
  - `src-tauri/resources/installers/macos/macFUSE.dmg` or `macFUSE.pkg`

## GitHub Release Requirements

- build workflow green on:
  - ubuntu-22.04
  - windows-latest
  - macos-latest
- Arch packaging workflow/job green
- release workflow prepared for `v*` tags
- artifacts uploaded for all three platforms
- Linux release artifacts include:
  - AppImage
  - `.deb`
  - `.rpm`
  - Arch package
  - `PKGBUILD`
  - `.SRCINFO`
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
