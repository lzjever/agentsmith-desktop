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

## macOS

Required:

- bundled `juicefs`
- `macFUSE`

Expected mount style:

- directory mount under the Desktop-managed root

Internal pilot expectation:

- Desktop detects missing `macFUSE`
- Desktop explains how to complete the system installation step

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

## Shared Rules

- a failed prerequisite check must block mount activation
- Doctor output must stay visible before and after sign-in
- diagnostics must record the last mount-precondition failure
