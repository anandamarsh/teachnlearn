#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

clear

LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/run_local_pip.log"

ensure_log_writable() {
  if : >"${LOG_FILE}" 2>/dev/null; then
    return 0
  fi

  echo "⚠ Unable to write to ${LOG_FILE}; attempting to fix permissions…" >&2
  if command -v sudo >/dev/null 2>&1; then
    if sudo chown -R "${USER}" "${LOG_DIR}" && sudo chmod u+rw "${LOG_DIR}" "${LOG_FILE}" 2>/dev/null; then
      if : >"${LOG_FILE}" 2>/dev/null; then
        echo "✅ Fixed log permissions via sudo chown/chmod." >&2
        return 0
      fi
    fi
  fi

  echo "❌ Unable to write to ${LOG_FILE}. Fix permissions manually (e.g. 'sudo chown -R ${USER} \"${LOG_DIR}\"') and rerun." >&2
  return 1
}

ensure_log_writable || exit 1

if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi

source .venv/bin/activate
if pip install -r requirements.txt >"${LOG_FILE}" 2>&1; then
  :
else
  echo "❌ Failed to install requirements:"
  cat "${LOG_FILE}"
  exit 1
fi

# Ensure dev server binds to fresh port each run
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:9000 2>/dev/null | xargs -r kill -9 || true
fi

# Load environment variables for bucket configuration if present
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

uvicorn main:app --host 0.0.0.0 --port 9000 --reload --reload-dir app --reload-dir .
