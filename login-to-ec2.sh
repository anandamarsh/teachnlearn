#!/usr/bin/env bash
set -euo pipefail

KEY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/teach-n-learn.pem"
USER="ubuntu"
HOST="54.252.188.193"
REMOTE_COMMAND="sudo /opt/learnnteach/ec2-launch.sh"

if [[ ! -f "$KEY_PATH" ]]; then
  echo "Key file not found: $KEY_PATH" >&2
  exit 1
fi

chmod 600 "$KEY_PATH"

if [[ "${1:-}" == "--deploy" ]]; then
  shift
  echo "Running ${REMOTE_COMMAND} on ${USER}@${HOST}..."
  ssh -t -i "$KEY_PATH" "$USER@$HOST" "$REMOTE_COMMAND" "$@"
else
  echo "Opening interactive session on ${USER}@${HOST}..."
  ssh -i "$KEY_PATH" "$USER@$HOST" "$@"
fi
