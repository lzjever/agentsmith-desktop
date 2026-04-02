# Internal Pilot Release Evidence

## Desktop Release Gates

Validated on April 1, 2026:

```bash
npm test
cargo test --manifest-path src-tauri/Cargo.toml
npm run typecheck
npm run build
npm run smoke:local-manual-mount
```

Observed results:

- frontend tests: `19 passed`
- Rust tests: `22 passed`
- typecheck: passed
- production build: passed
- local mount smoke: passed with 3 successful mount/unmount cycles against `Desktop Integration Library`

## Web Coordination Evidence

Validated in the main `agentsmith` repo on April 1, 2026:

```bash
npm test -- packages/api-entry-node/src/project-file-library-routes.test.ts src/components/files/__tests__/FilesPage.test.tsx
npx tsc --noEmit
npm run test:e2e:integration:files:management-ux
```

Observed results:

- Files component and API route tests: passed
- `tsc`: passed
- backend-real Files/Desktop walkthrough: passed

Screenshot evidence from the main `agentsmith` repo:

- `test-results/integration-files-manageme-e904e-erator-friendly-recovery-UX-chromium/files-ready-overview.png`
- `test-results/integration-files-manageme-e904e-erator-friendly-recovery-UX-chromium/files-ready-desktop-dialog.png`
- `test-results/integration-files-manageme-e904e-erator-friendly-recovery-UX-chromium/files-ready-desktop-dialog-debug.png`
- `test-results/integration-files-manageme-e904e-erator-friendly-recovery-UX-chromium/files-degraded-overview.png`
- `test-results/integration-files-manageme-e904e-erator-friendly-recovery-UX-chromium/files-degraded-delete-dialog.png`

## Release Artifact Expectations

Current draft release target:

- tag: `v0.1.4`
- expected assets:
  - AppImage
  - `.deb`
  - `.rpm`
  - Windows installer (`.msi` / setup executable)
  - macOS archive (`.dmg` / `.app.tar.gz`)
  - Arch package (`.pkg.tar.zst`)
  - `PKGBUILD`
  - `.SRCINFO`

Desktop download guidance in the web UI is allowed to point to the GitHub latest release page as long as the assets above exist.
