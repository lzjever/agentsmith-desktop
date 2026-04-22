# Changelog

All notable changes to this project will be documented in this file.

## [0.1.5] - 2026-04-22

### Fixed

- Use the connected deployment URL for desktop sign-in when the auth bootstrap reports a bind-only address such as `0.0.0.0`, preventing broken browser login handoffs.
- Add regression coverage for desktop auth bootstrap responses that return non-client-visible deployment addresses.
