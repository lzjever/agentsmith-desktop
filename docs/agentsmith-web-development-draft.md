# AgentSmith Web Development Draft for Desktop Support

## 1. Summary

AgentSmith web should evolve from a human shell-command mount workflow to a productized desktop-client workflow.

The web side remains the control plane and source of truth for:

- user identity
- file library ownership and visibility
- desktop app authorization
- mount-access issuance
- library lifecycle changes

## 2. Core direction

### 2.1 Separate desktop and manual contracts

Do not make the desktop client consume the current manual shell-command mount payload.

Instead, define two distinct contracts:

- `desktop_mount_access`
  - machine-oriented
  - no shell commands
  - intended for AgentSmith Desktop only
- `manual_mount_access`
  - human-oriented
  - retains recommended shell commands
  - exposed only as an advanced/debug workflow

### 2.2 Manual mount becomes an advanced/debug feature

Web UX should demote manual mount:

- remove it from the primary Files path
- relabel it as advanced/debug
- make Desktop the primary recommended local-mount workflow

## 3. New web/backend capabilities

### 3.1 Desktop OAuth support

AgentSmith should provide a proper desktop OAuth entry flow:

- auth start endpoint for desktop client
- PKCE-compatible code flow
- localhost callback-compatible redirect model
- token exchange behavior suitable for one desktop companion app

### 3.2 Desktop-aware mount access

The backend should issue a desktop-specific mount access payload that includes:

- file library identity
- desktop-usable metadata endpoint
- desktop-usable storage endpoint
- scope and lifetime constraints
- enough information for the client to detect staleness or revocation

### 3.3 Library sync behavior

The web side should support desktop polling or refresh behavior for:

- library list
- renamed libraries
- deleted libraries
- permission removal

## 4. Runtime truth requirements

Desktop-facing file-library addresses must keep following the existing address-governance model:

- client-visible truth for local desktop users
- never leak runner-only or internal-only addresses
- never use host-local or loopback values as client truth

Desktop support should reuse the same address-governance discipline already established in AgentSmith.

## 5. Web UX changes

### Files page

- add a primary “Open in AgentSmith Desktop” or similar workflow
- manual mount becomes secondary
- clarify that Desktop is the recommended local mount path

### Login/connect experience

- optionally support web-to-desktop launch handoff later
- v1 can begin with URL-based deployment configuration and browser OAuth

## 6. Testing

### Backend tests

- desktop auth start / callback / token exchange
- desktop mount access issuance
- client-visible address correctness
- library deletion or permission loss propagation

### Frontend tests

- manual mount demoted to advanced/debug
- Desktop CTA visible in Files
- correct behavior when desktop integration is unavailable

### Backend-real

- desktop OAuth with localhost callback
- desktop mount access retrieval
- one library mounted successfully using client-visible access
