#!/usr/bin/env bash
#
# Deploy the latest committed code and record the release.
#
# Collapses the manual pull/install/build/restart sequence into one command and
# appends an audit line to DEPLOY_LOG. Any failed step aborts and is recorded.
#
# Usage (run as a user that can sudo to the catan service account):
#   sudo bash /opt/catan/deploy/release.sh
#
# There is no database to back up. Rooms live in memory (ADR-0007), so the
# restart below ENDS EVERY MATCH IN PROGRESS. Release when nobody is playing.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/catan}"
APP_USER="${APP_USER:-catan}"
SERVICE="${SERVICE:-catan}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8787/health}"
DEPLOY_LOG="${DEPLOY_LOG:-/var/log/catan/deploy.log}"
# Under `sudo -u catan`, whoami is "catan"; SUDO_USER preserves the real operator.
OPERATOR="${SUDO_USER:-$(whoami)}"

as_app() { sudo -u "$APP_USER" "$@"; }

# ISO-8601 with local offset, matching the deploy.log column format.
now() { date +%Y-%m-%dT%H:%M:%S%z; }

record() { # <old> <new> <result> <detail>
  printf '%s  %s → %s  by %s  %-8s (%s)\n' \
    "$(now)" "$1" "$2" "$OPERATOR" "$3" "$4" >> "$DEPLOY_LOG"
}

mkdir -p "$(dirname "$DEPLOY_LOG")"
cd "$APP_DIR"

OLD_COMMIT="$(as_app git rev-parse --short HEAD)"

fail() { # <detail>
  record "$OLD_COMMIT" "$OLD_COMMIT" FAILED "$1"
  echo "Release FAILED at: $1" >&2
  exit 1
}

# Warn about live games before the restart drops them.
ROOMS="$(curl -fsS "$HEALTH_URL" 2>/dev/null | sed -n 's/.*"rooms":\([0-9]*\).*/\1/p' || true)"
if [ -n "$ROOMS" ] && [ "$ROOMS" != "0" ]; then
  echo "NOTE: $ROOMS room(s) currently held in memory; restarting will end them."
fi

BUILD_START="$(date +%s)"

as_app git pull --ff-only             || fail "git pull"
as_app pnpm install --frozen-lockfile || fail "pnpm install"
as_app pnpm build                     || fail "pnpm build"

NEW_COMMIT="$(as_app git rev-parse --short HEAD)"

sudo systemctl restart "$SERVICE"     || fail "systemctl restart"

# Poll the health endpoint for up to 30s before declaring success.
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    BUILD_SECONDS="$(( $(date +%s) - BUILD_START ))"
    record "$OLD_COMMIT" "$NEW_COMMIT" OK "build ${BUILD_SECONDS}s"
    echo "Release OK: $OLD_COMMIT → $NEW_COMMIT"
    exit 0
  fi
  sleep 1
done

fail "health check timeout"
