#!/usr/bin/env bash
# Install or refresh the 4x-daily backup crontab without wiping other jobs.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
CRON_FILE="${SCRIPT_DIR}/backup.crontab"
BEGIN="# BEGIN SL-EXCHANGE-BACKUP"
END="# END SL-EXCHANGE-BACKUP"

chmod +x "${APP_ROOT}/scripts/backup-cron.sh"
mkdir -p "${APP_ROOT}/backups"

if [[ ! -f "${CRON_FILE}" ]]; then
  echo "Missing ${CRON_FILE}" >&2
  exit 1
fi

existing="$(mktemp)"
merged="$(mktemp)"
crontab -l 2>/dev/null > "${existing}" || true

awk -v begin="${BEGIN}" -v end="${END}" '
  $0 == begin { skip=1; next }
  skip && $0 == end { skip=0; next }
  skip { next }
  { print }
' "${existing}" > "${merged}"

{
  cat "${merged}"
  echo
  sed "s#/opt/SriLankaExchangeRate#${APP_ROOT}#g" "${CRON_FILE}"
} | awk 'NF || !blank { if (NF) blank=0; else if (blank++) next; print }' > "${existing}"

crontab "${existing}"
rm -f "${existing}" "${merged}"

echo "Installed backup cron for ${APP_ROOT}"
echo "Schedule: 00:00, 06:00, 12:00, 18:00 Asia/Colombo"
echo "Backups:  ${APP_ROOT}/backups"
echo
crontab -l | awk -v begin="${BEGIN}" -v end="${END}" '
  $0 == begin { show=1 }
  show { print }
  $0 == end { show=0 }
'
