# AgentSmith Desktop Development Draft

## 1. Summary

Build AgentSmith Desktop as a cross-platform Tauri 2 + Rust application, using the existing `browsion` repo as a technology reference for desktop shell patterns, tray behavior, packaging shape, and Rust-backed local control logic.

V1 is a mount supervisor app for AgentSmith file libraries.

## 2. Architecture

### 2.1 Desktop shell

- Tauri 2 desktop app
- Rust backend for:
  - mount supervision
  - OAuth callback handling
  - local config/state
  - prerequisite detection
  - subprocess management for JuiceFS
  - tray integration
- React/TypeScript frontend for:
  - sign-in flow
  - library list
  - mount state
  - diagnostics
  - settings

### 2.2 Local state

Keep local state intentionally simple:

- current deployment base URL
- current signed-in user summary
- stored token / refresh state
- active library ids
- local aliases for libraries
- per-library mount state
- last-known diagnostics

Do not support:

- multiple deployments in one app session
- in-app deployment switching
- multiple concurrent users

### 2.3 Auth flow

- Desktop generates PKCE verifier/challenge
- Desktop starts a localhost callback server
- Desktop opens the system browser
- AgentSmith completes OAuth and redirects to localhost callback
- Desktop exchanges the auth code for tokens
- Tokens are stored in OS-appropriate secure storage when possible

### 2.4 Mount supervision

- The app owns the lifetime of JuiceFS mount processes
- While the tray app is alive, active mounts stay supervised
- When the app exits, all active mounts are unmounted or stopped
- On restart, the app restores previously active mounts

## 3. Platform strategy

### 3.1 Windows

- Treat Windows as drive-letter-first
- Bundle `juicefs.exe`
- Detect WinFsp
- Launch bundled installer when missing
- Let the app assign or allow choosing a free drive letter

### 3.2 macOS

- Bundle JuiceFS binary
- Detect macFUSE
- Launch bundled installer when missing
- Use a stable directory-based mount root

### 3.3 Linux

- Bundle JuiceFS binary
- Detect `/dev/fuse`, `fusermount`, and common FUSE prerequisites
- Support mainline distributions first
- Use clear diagnostics when the host distro policy blocks full automation

## 4. V1 Modules

### 4.1 Bootstrap / Doctor

- platform detection
- dependency checks
- installer handoff or guidance
- post-install recheck

### 4.2 Deployment session

- configure one AgentSmith base URL
- sign in
- restore previous signed-in state if valid

### 4.3 Library browser

- fetch all visible file libraries
- sort by creation time descending
- show status and local alias

### 4.4 Mount manager

- activate mount
- deactivate mount
- recover active mounts on restart
- detect deleted or inaccessible libraries and clean them up

### 4.5 Diagnostics

- dependency status
- login status
- last mount failure
- open local mount location
- export logs

## 5. Packaging

- Per-platform installers
- Bundle JuiceFS binaries with the app
- Bundle platform prerequisite installers where licensing/distribution allows
- Keep installer logic separate from runtime mount logic

## 6. Desktop API boundary

The desktop app should consume app-oriented AgentSmith contracts, not the current human-facing shell-oriented mount contract.

Preferred server-facing capabilities:

- desktop login entry metadata
- list file libraries for desktop
- get desktop mount access for one library
- refresh or invalidate desktop mount access
- notify when library access disappears

## 7. Testing

### Unit

- mount state transitions
- OAuth callback state handling
- mount restore rules
- drive-letter allocation on Windows
- dependency detector logic

### Integration

- login callback exchange
- mount supervisor process lifecycle
- restore-on-restart
- missing dependency flows
- library deletion / permission removal cleanup

### Manual / system rehearsal

- Windows with WinFsp missing then installed
- macOS with macFUSE missing then installed
- Linux on supported distro with FUSE available
- login -> activate mount -> restart app -> restore mount
- exit app -> mount disappears
