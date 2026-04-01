# AgentSmith Desktop PRD v1

## 1. Summary

AgentSmith Desktop is the local desktop companion app for AgentSmith.  
V1 only delivers one end-user capability: mount and manage the current user's AgentSmith file libraries on the local machine without requiring manual JuiceFS shell commands.

The product is designed as a future-facing desktop shell. Later versions may add more local capabilities, but V1 intentionally limits scope to file-library mounting.

## 2. Product Positioning

- Product name: `AgentSmith Desktop`
- Repository name: `agentsmith-desktop`
- Relationship to AgentSmith web:
  - AgentSmith web is the control plane
  - AgentSmith Desktop is the local companion app

## 3. V1 Goals

- Remove the current geeky manual mount flow from the main user path
- Let users sign in with AgentSmith using OAuth in the system browser
- Show all file libraries visible to the current user
- Allow users to activate or deactivate local mounts
- Restore active mounts automatically when the app restarts
- Unmount and stop local mount supervision when the app exits
- Keep a tray app running for status and quick actions

## 4. Out of Scope

- Multi-deployment support inside one running app session
- Multiple concurrent login states
- Full local file sync UX beyond mount management
- VNC/container login flows
- Local agent configuration workflows
- Silent installation of every OS-level dependency on every platform

## 5. Product Rules

### 5.1 Deployment model

- The desktop app connects to exactly one AgentSmith deployment at a time
- To switch deployment, the user exits and signs in again

### 5.2 Login model

- OAuth + PKCE
- System browser
- Localhost callback

### 5.3 Mount model

- The app lists all visible file libraries
- Default ordering: newest first
- Libraries are not auto-mounted by default
- The user explicitly activates or deactivates a mount
- Active mount choices are remembered locally
- On app restart, previously active mounts are restored
- If a library is deleted or access is removed, the app unmounts it and clears the local state

### 5.4 App lifecycle

- Tray app is the runtime supervisor for all local mounts
- If the user fully exits the app, mounts are expected to stop being available

### 5.5 Display names

- The app may let the user define a local alias per mounted library
- The alias is local-only and is not written back to AgentSmith

### 5.6 Manual mount path

- Manual shell-based mount remains available only as a debugging or advanced workflow
- It is not the main product path
- Web UX should weaken and relabel it as an advanced/debug feature

## 6. Platform Expectations

### Linux / macOS

- Directory-style mounts
- Default mount root should be product-owned and stable
- Recommended shape:
  - `~/AgentSmith/<workspace>/<library>`

### Windows

- Drive-letter-first model
- The app manages drive-letter assignment
- The UI still presents a simple “local mount” mental model

## 7. Dependency Strategy

- JuiceFS client binaries should be bundled with the app
- OS-level filesystem dependencies may still require system installation:
  - Linux: FUSE stack
  - macOS: macFUSE
  - Windows: WinFsp
- The app should minimize user burden by:
  - detecting missing prerequisites
  - guiding or launching bundled installers where possible
  - resuming automatically after installation steps complete

## 8. Core UX

The first-run experience should be:

1. Launch app
2. Dependency doctor runs
3. User signs in via browser
4. App shows all available libraries
5. User activates selected libraries
6. App mounts them and shows local status

## 9. Success Criteria

- A normal user never needs to copy a JuiceFS mount command
- A normal user can sign in, activate a library, and use it locally
- The app can recover active mounts after restart
- The app can explain failures clearly when prerequisites or permissions are missing
