#!/usr/bin/env bash
set -euo pipefail

DEPLOYMENT_BASE_URL="${DEPLOYMENT_BASE_URL:-http://localhost:3101}"
API_BASE_URL="${API_BASE_URL:-http://localhost:21000}"
KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://localhost:18080}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-mbos}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-agentsmith}"
DESKTOP_SMOKE_USERNAME="${DESKTOP_SMOKE_USERNAME:-dev-admin}"
DESKTOP_SMOKE_PASSWORD="${DESKTOP_SMOKE_PASSWORD:-dev-admin-123}"
WORKSPACE_ID="${WORKSPACE_ID:-ws_default}"
LIBRARY_NAME="${LIBRARY_NAME:-Desktop Integration Library}"
CYCLES="${CYCLES:-3}"
TARGET_ROOT="${TARGET_ROOT:-$HOME/AgentSmith}"
LOG_PATH="${LOG_PATH:-/tmp/agentsmith-desktop-mount-smoke.log}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

need_cmd curl
need_cmd jq
need_cmd juicefs
need_cmd mountpoint

unmount_target() {
  local target="$1"
  if command -v fusermount3 >/dev/null 2>&1; then
    fusermount3 -uz "$target" >/dev/null 2>&1 || true
  fi
  if command -v fusermount >/dev/null 2>&1; then
    fusermount -uz "$target" >/dev/null 2>&1 || true
  fi
  if command -v umount >/dev/null 2>&1; then
    umount -l "$target" >/dev/null 2>&1 || true
  fi
}

get_token() {
  curl -fsS -X POST \
    "${KEYCLOAK_BASE_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "grant_type=password" \
    --data-urlencode "client_id=${KEYCLOAK_CLIENT_ID}" \
    --data-urlencode "username=${DESKTOP_SMOKE_USERNAME}" \
    --data-urlencode "password=${DESKTOP_SMOKE_PASSWORD}" \
    | jq -r '.access_token'
}

echo "[desktop-smoke] deployment=${DEPLOYMENT_BASE_URL}"
echo "[desktop-smoke] api=${API_BASE_URL}"
echo "[desktop-smoke] library=${LIBRARY_NAME}"

AUTH_JSON="$(curl -fsS "${DEPLOYMENT_BASE_URL}/api/public/desktop/auth")"
echo "$AUTH_JSON" | jq . >/dev/null

TOKEN="$(get_token)"
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "[desktop-smoke] failed to get token" >&2
  exit 1
fi

LIBRARIES_JSON="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" "${API_BASE_URL}/api/v1/me/desktop/file-libraries")"
LIBRARY_ID="$(printf '%s\n' "$LIBRARIES_JSON" | jq -r --arg name "$LIBRARY_NAME" '.items[] | select(.name == $name) | .id' | head -n1)"
PROJECT_ID="$(printf '%s\n' "$LIBRARIES_JSON" | jq -r --arg name "$LIBRARY_NAME" '.items[] | select(.name == $name) | .project_id' | head -n1)"

if [[ -z "$LIBRARY_ID" || "$LIBRARY_ID" == "null" || -z "$PROJECT_ID" || "$PROJECT_ID" == "null" ]]; then
  echo "[desktop-smoke] target library not found: ${LIBRARY_NAME}" >&2
  printf '%s\n' "$LIBRARIES_JSON" | jq .
  exit 1
fi

ACCESS_JSON="$(curl -fsS -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  "${API_BASE_URL}/api/v1/workspaces/${WORKSPACE_ID}/projects/${PROJECT_ID}/file-libraries/${LIBRARY_ID}/desktop-mount-access")"

METADATA_URL="$(printf '%s\n' "$ACCESS_JSON" | jq -r '.desktop_mount_access.metadata_url')"
BUCKET_URL="$(printf '%s\n' "$ACCESS_JSON" | jq -r '.desktop_mount_access.storage_bucket_url')"
TARGET_PATH="${TARGET_ROOT}/${WORKSPACE_ID}/${LIBRARY_ID}"

if [[ -z "$METADATA_URL" || "$METADATA_URL" == "null" ]]; then
  echo "[desktop-smoke] desktop mount metadata missing" >&2
  printf '%s\n' "$ACCESS_JSON" | jq .
  exit 1
fi

echo "[desktop-smoke] target=${TARGET_PATH}"

cleanup() {
  unmount_target "$TARGET_PATH"
}
trap cleanup EXIT

for ((i=1; i<=CYCLES; i++)); do
  echo "[desktop-smoke] cycle ${i}/${CYCLES}: preclean"
  unmount_target "$TARGET_PATH"
  mkdir -p "$TARGET_PATH"

  echo "[desktop-smoke] cycle ${i}/${CYCLES}: mount"
  if [[ -n "$BUCKET_URL" && "$BUCKET_URL" != "null" ]]; then
    juicefs mount "$METADATA_URL" "$TARGET_PATH" \
      --bucket "$BUCKET_URL" \
      --check-storage \
      --attr-cache 0 \
      --entry-cache 0 \
      --dir-entry-cache 0 >"$LOG_PATH" 2>&1 &
  else
    juicefs mount "$METADATA_URL" "$TARGET_PATH" \
      --check-storage \
      --attr-cache 0 \
      --entry-cache 0 \
      --dir-entry-cache 0 >"$LOG_PATH" 2>&1 &
  fi
  JFS_PID=$!

  mounted=0
  for _ in $(seq 1 40); do
    if mountpoint -q "$TARGET_PATH"; then
      mounted=1
      break
    fi
    if ! kill -0 "$JFS_PID" >/dev/null 2>&1; then
      echo "[desktop-smoke] cycle ${i}/${CYCLES}: juicefs exited early" >&2
      cat "$LOG_PATH" >&2
      exit 1
    fi
    sleep 0.25
  done

  if [[ "$mounted" -ne 1 ]]; then
    echo "[desktop-smoke] cycle ${i}/${CYCLES}: mount timeout" >&2
    cat "$LOG_PATH" >&2
    exit 1
  fi

  echo "[desktop-smoke] cycle ${i}/${CYCLES}: mounted"
  kill "$JFS_PID" >/dev/null 2>&1 || true
  wait "$JFS_PID" >/dev/null 2>&1 || true

  echo "[desktop-smoke] cycle ${i}/${CYCLES}: unmount"
  unmount_target "$TARGET_PATH"
  sleep 0.5
  if mountpoint -q "$TARGET_PATH"; then
    echo "[desktop-smoke] cycle ${i}/${CYCLES}: stale mount remained" >&2
    exit 1
  fi
  echo "[desktop-smoke] cycle ${i}/${CYCLES}: clean"
done

echo "[desktop-smoke] success"
