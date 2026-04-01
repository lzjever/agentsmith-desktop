# Platform Prerequisites

## Summary

AgentSmith Desktop bundles the JuiceFS client binary, but it still depends on platform filesystem support to mount libraries locally.

Desktop should detect these prerequisites automatically and explain what is missing.

## Windows

Required:

- `juicefs.exe` bundled with the app
- `WinFsp`

Expected mount style:

- drive-letter-first

Internal pilot expectation:

- Desktop detects missing `WinFsp`
- Desktop can hand off to a bundled installer or clear installation guidance

Bundled installer handoff:

- preferred bundle location: `src-tauri/resources/installers/windows/`
- preferred filenames: `WinFsp.msi` or `WinFsp.exe`
- optional override env for local testing: `AGENTSMITH_DESKTOP_INSTALLER_WINFSP`
- if no bundled installer is present, Desktop falls back to the public setup guide

## macOS

Required:

- bundled `juicefs`
- `macFUSE`

Expected mount style:

- directory mount under the Desktop-managed root

Internal pilot expectation:

- Desktop detects missing `macFUSE`
- Desktop explains how to complete the system installation step

Bundled installer handoff:

- preferred bundle location: `src-tauri/resources/installers/macos/`
- preferred filenames: `macFUSE.dmg` or `macFUSE.pkg`
- optional override env for local testing: `AGENTSMITH_DESKTOP_INSTALLER_MACFUSE`
- if no bundled installer is present, Desktop falls back to the public setup guide

## Linux

Required:

- bundled `juicefs`
- `/dev/fuse`
- `fusermount3` or `fusermount`

Expected mount style:

- directory mount under the Desktop-managed root

Internal pilot expectation:

- Desktop detects missing FUSE support
- Desktop explains the missing prerequisite instead of failing silently
- internal pilot Linux deliverables include:
  - AppImage
  - `.deb`
  - `.rpm`
  - Arch Linux package (`agentsmith-desktop-bin`)

Bundled installer handoff:

- Linux does not bundle a prerequisite installer in the internal pilot
- Desktop always falls back to the setup guide for Linux prerequisite gaps

Arch package:

- package name: `agentsmith-desktop-bin`
- packaging metadata lives in `packaging/arch/`
- generate metadata with:
  - `npm run package:arch:metadata`
- build the package on an Arch-based host with:
  - `npm run package:arch`
- package artifacts are written to:
  - `packaging/arch/out/dist/`

## Shared Rules

- a failed prerequisite check must block mount activation
- Doctor output must stay visible before and after sign-in
- diagnostics must record the last mount-precondition failure
