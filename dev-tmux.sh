#!/usr/bin/env bash
set -euo pipefail

SESSION="${1:-teachnlearn}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEARNER_NAME="📘 learner"
TEACHER_NAME="🧑‍🏫 teacher"
SERVER_NAME="🧠 server"
EC2_NAME="☁️ ec2"
SCRATCH_NAME="🧰 scratch"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  exec tmux attach -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" -n "dev" "cd \"$ROOT_DIR/learner-portal\" && npm run dev"
tmux set-option -t "$SESSION" pane-border-status top
tmux set-option -t "$SESSION" pane-border-format " #{pane_title} "

pane0="$(tmux display-message -p -t "$SESSION:0" "#{pane_id}")"
tmux select-pane -t "$pane0" -T "$LEARNER_NAME"
tmux select-pane -t "$pane0" -P "fg=colour39"

pane1="$(tmux split-window -t "$pane0" -h -P -F "#{pane_id}" "cd \"$ROOT_DIR/teacher-portal\" && npm run dev")"
tmux select-pane -t "$pane1" -T "$TEACHER_NAME"
tmux select-pane -t "$pane1" -P "fg=colour220"

pane2="$(tmux split-window -t "$pane0" -v -P -F "#{pane_id}" "cd \"$ROOT_DIR/learning-server\" && ./run-local.sh")"
tmux select-pane -t "$pane2" -T "$SERVER_NAME"
tmux select-pane -t "$pane2" -P "fg=colour113"

pane3="$(tmux split-window -t "$pane1" -v -P -F "#{pane_id}" "cd \"$ROOT_DIR\" && ./login-to-ec2.sh")"
tmux select-pane -t "$pane3" -T "$EC2_NAME"
tmux select-pane -t "$pane3" -P "fg=colour203"

pane4="$(tmux split-window -t "$pane3" -v -P -F "#{pane_id}" "cd \"$ROOT_DIR\" && zsh")"
tmux select-pane -t "$pane4" -T "$SCRATCH_NAME"
tmux select-pane -t "$pane4" -P "fg=colour244"

tmux set-option -t "$SESSION" allow-rename off
tmux select-layout -t "$SESSION:0" tiled
tmux select-pane -t "$pane0"
exec tmux attach -t "$SESSION"
