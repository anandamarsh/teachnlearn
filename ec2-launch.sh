#!/usr/bin/env bash

set -euo pipefail

GREEN="\033[32m"
RED="\033[31m"
BLUE="\033[34m"
YELLOW="\033[33m"
RESET="\033[0m"

clear

echo -e "${BLUE}==> Teach-n-Learn deployment helper${RESET}"
echo

run_step() {
  local description="$1"
  shift
  echo -ne "${BLUE}→ ${description}...${RESET}"
  local log_file
  log_file="$(mktemp "${TMPDIR:-/tmp}/launch_step.XXXXXX.log")"
  if "$@" >"$log_file" 2>&1; then
    echo -e " ${GREEN}done${RESET}"
  else
    echo -e " ${RED}failed${RESET}"
    echo "--- command output ---"
    cat "$log_file"
    echo "----------------------"
    rm -f "$log_file"
    exit 1
  fi
  rm -f "$log_file"
}

# Ensure we're in the repo and up to date
cd /opt/teachnlearn/
run_step "Resetting local changes" git reset --hard HEAD
run_step "Pulling latest code" git pull origin main

run_step "Removing .env.local overrides" find . -name '.env.local' -type f -print -delete

# Stop services
if systemctl list-unit-files | grep -q "^teachnlearn-api\\.service"; then
  run_step "Stopping Teach-n-Learn API" sudo systemctl stop teachnlearn-api
else
  echo -e "${YELLOW}⚠ teachnlearn-api not running or not installed; skipping stop.${RESET}"
fi
run_step "Stopping Caddy" sudo systemctl stop caddy

# Server dependencies (Python virtualenv)
VENV_DIR="learning-server/venv"

# Clean up legacy .venv if present but different
if [[ -d "learning-server/.venv" && ! -d "$VENV_DIR" ]]; then
  echo -e "${YELLOW}⚠ Found legacy learning-server/.venv. Removing in favour of $VENV_DIR.${RESET}"
  rm -rf learning-server/.venv
fi

if [[ -x "$VENV_DIR/bin/pip" ]]; then
  run_step "Installing server requirements" "$VENV_DIR/bin/pip" install -r learning-server/requirements.txt
else
  echo -e "${YELLOW}⚠ $VENV_DIR/bin/pip not found. Creating virtualenv...${RESET}"
  rm -rf "$VENV_DIR"
  if run_step "Creating server virtualenv" python3 -m venv "$VENV_DIR"; then
    run_step "Installing server requirements" "$VENV_DIR/bin/pip" install -r learning-server/requirements.txt
  else
    echo -e "${RED}❌ Failed to create $VENV_DIR. Aborting deployment.${RESET}"
    exit 1
  fi
fi

# Install/refresh systemd unit for the API
API_SERVICE_PATH="/etc/systemd/system/teachnlearn-api.service"
run_step "Writing API systemd unit" sudo tee "$API_SERVICE_PATH" >/dev/null <<'SERVICE'
[Unit]
Description=Teach-n-Learn FastAPI
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/teachnlearn/learning-server
EnvironmentFile=/opt/teachnlearn/learning-server/.env
ExecStart=/opt/teachnlearn/learning-server/venv/bin/uvicorn main:app --host 0.0.0.0 --port 9000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

run_step "Reloading systemd" sudo systemctl daemon-reload
run_step "Enabling Teach-n-Learn API" sudo systemctl enable teachnlearn-api
run_step "Restarting Teach-n-Learn API" sudo systemctl restart teachnlearn-api

# Client build and deploy
run_step "Installing TP dependencies" npm --prefix teacher-portal install --legacy-peer-deps
run_step "Building TP" npm --prefix teacher-portal run build
if [[ -d "teacher-portal/dist" ]]; then
  run_step "Creating /var/www/teacher-portal directory" sudo mkdir -p /var/www/teacher-portal
  run_step "Syncing TP build to /var/www/teacher-portal" \
    sudo rsync -av --delete teacher-portal/dist/ /var/www/teacher-portal/
else
  echo -e "${RED}❌ teacher-portal/dist not found. Build may have failed.${RESET}"
  exit 1
fi

run_step "Installing LP dependencies" npm --prefix learner-portal install --legacy-peer-deps
run_step "Building LP" npm --prefix learner-portal run build
if [[ -d "learner-portal/dist" ]]; then
  run_step "Creating /var/www/learner-portal directory" sudo mkdir -p /var/www/learner-portal
  run_step "Syncing LP build to /var/www/learner-portal" \
    sudo rsync -av --delete learner-portal/dist/ /var/www/learner-portal/
else
  echo -e "${RED}❌ learner-portal/dist not found. Build may have failed.${RESET}"
  exit 1
fi

# Update Caddy config
if [[ -f "Caddyfile" ]]; then
  run_step "Updating Caddyfile" sudo cp Caddyfile /etc/caddy/Caddyfile
else
  echo -e "${RED}❌ Caddyfile missing at repo root.${RESET}"
  exit 1
fi

# Restart Caddy to pick up new config and assets
run_step "Restarting Caddy" sudo systemctl restart caddy

echo
echo -e "${GREEN}Deployment complete.${RESET}"
echo -e "${BLUE}Monitor logs with:${RESET}"
echo "  FastAPI: sudo journalctl -u teachnlearn-api -f"
echo "  Caddy:   sudo journalctl -u caddy -f"

echo
sudo journalctl -u teachnlearn-api -f
