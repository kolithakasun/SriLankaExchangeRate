#!/usr/bin/env bash
# Daily backup wrapper: dump → validate → compress → safe prune.
#
# Intended for cron (4x/day). Defaults work from this repo or from
# /opt/SriLankaExchangeRate. Override with env vars if needed.
#
# Safety: archives older than RETENTION_DAYS are removed only when there
# are newer successful backups. If the database has been failing longer
# than the retention window, old copies are kept.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-${APP_ROOT}/backups}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-${APP_ROOT}/scripts/backup-db.mjs}"
NODE_BIN="${NODE_BIN:-}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MIN_KEEP="${MIN_KEEP:-8}"
STALE_HOURS="${STALE_HOURS:-36}"
LOCK_FILE="${LOCK_FILE:-${BACKUP_DIR}/.backup.lock}"
LOG_FILE="${LOG_FILE:-${BACKUP_DIR}/backup.log}"

mkdir -p "${BACKUP_DIR}"

log() {
  local line="[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
  echo "${line}"
  echo "${line}" >> "${LOG_FILE}"
}

find_node() {
  if [[ -n "${NODE_BIN}" && -x "${NODE_BIN}" ]]; then
    echo "${NODE_BIN}"
    return
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  for candidate in /usr/local/bin/node /usr/bin/node /opt/homebrew/bin/node; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return
    fi
  done
  return 1
}

write_status() {
  local name="$1"
  cat > "${BACKUP_DIR}/${name}" <<EOF
at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
epoch=$(date +%s)
message=$2
EOF
}

latest_success_age_hours() {
  local status="${BACKUP_DIR}/LAST_SUCCESS"
  if [[ ! -f "${status}" ]]; then
    echo "9999"
    return
  fi
  local epoch
  epoch="$(awk -F= '/^epoch=/{print $2}' "${status}")"
  if [[ -z "${epoch}" ]]; then
    echo "9999"
    return
  fi
  echo $(( ($(date +%s) - epoch) / 3600 ))
}

validate_dump() {
  local dir="$1"
  local manifest="${dir}/manifest.json"
  if [[ ! -f "${manifest}" ]]; then
    log "ERROR: dump is missing manifest.json"
    return 1
  fi
  if ! grep -q '"source": "supabase"' "${manifest}"; then
    log "ERROR: dump source is not supabase (refusing to treat this as a safe backup)"
    return 1
  fi
  for table in banks currencies daily_rates exchange_rates; do
    if [[ ! -f "${dir}/${table}.json" ]]; then
      log "ERROR: dump is missing ${table}.json"
      return 1
    fi
  done
  return 0
}

compress_dump() {
  local dir="$1"
  local archive="${dir}.tar.gz"
  local parent base
  parent="$(dirname "${dir}")"
  base="$(basename "${dir}")"
  tar -czf "${archive}.partial" -C "${parent}" "${base}"
  mv "${archive}.partial" "${archive}"
  rm -rf "${dir}"
  echo "${archive}"
}

# Never delete the last good copies just because they aged past 2 weeks
# while new dumps were failing.
prune_old_archives() {
  local cutoff epoch file keep_count recent_count
  cutoff=$(( $(date +%s) - RETENTION_DAYS * 24 * 60 * 60 ))
  recent_count=0
  keep_count=0

  local -a archives=()
  while IFS= read -r file; do
    [[ -n "${file}" ]] && archives+=("${file}")
  done < <(ls -1t "${BACKUP_DIR}"/*.tar.gz 2>/dev/null || true)

  if [[ ${#archives[@]} -eq 0 ]]; then
    log "No compressed archives to prune"
    return
  fi

  recent_count="$(find "${BACKUP_DIR}" -maxdepth 1 -type f -name "*.tar.gz" -mtime -"${RETENTION_DAYS}" | wc -l | tr -d ' ')"

  if (( recent_count == 0 )); then
    log "KEEPING old backups: none succeeded in the last ${RETENTION_DAYS} days. Not deleting the last good copies."
    write_status STALE_ALERT "No successful backup newer than ${RETENTION_DAYS} days; prune skipped"
    return
  fi

  rm -f "${BACKUP_DIR}/STALE_ALERT"

  for file in "${archives[@]}"; do
    keep_count=$((keep_count + 1))
    epoch="$(stat -f %m "${file}" 2>/dev/null || stat -c %Y "${file}")"
    if (( keep_count <= MIN_KEEP )); then
      continue
    fi
    if (( epoch < cutoff )); then
      log "Removing expired archive ${file}"
      rm -f "${file}"
    fi
  done
}

cleanup_incomplete_dirs() {
  local dir epoch cutoff
  cutoff=$(( $(date +%s) - 2 * 24 * 60 * 60 ))
  while IFS= read -r dir; do
    [[ -z "${dir}" ]] && continue
    epoch="$(stat -f %m "${dir}" 2>/dev/null || stat -c %Y "${dir}")"
    if (( epoch < cutoff )) && [[ ! -f "${dir}/manifest.json" ]]; then
      log "Removing incomplete dump dir ${dir}"
      rm -rf "${dir}"
    fi
  done < <(find "${BACKUP_DIR}" -maxdepth 1 -mindepth 1 -type d -print)
}

run_backup() {
  local node_bin output dir archive age
  if ! node_bin="$(find_node)"; then
    log "ERROR: node is not on PATH. Set NODE_BIN=/full/path/to/node"
    write_status LAST_FAILURE "node not found"
    return 1
  fi

  if [[ ! -f "${BACKUP_SCRIPT}" ]]; then
    log "ERROR: backup script missing at ${BACKUP_SCRIPT}"
    write_status LAST_FAILURE "backup script missing"
    return 1
  fi

  log "Starting backup with ${node_bin} ${BACKUP_SCRIPT} --out ${BACKUP_DIR}"
  set +e
  output="$("${node_bin}" "${BACKUP_SCRIPT}" --out "${BACKUP_DIR}" --require-supabase 2>&1)"
  local status=$?
  set -e
  echo "${output}" | tee -a "${LOG_FILE}"

  if (( status != 0 )); then
    log "ERROR: backup command failed (exit ${status})"
    write_status LAST_FAILURE "backup command failed (exit ${status})"
    age="$(latest_success_age_hours)"
    if (( age >= STALE_HOURS )); then
      log "ALERT: last successful backup was ${age} hours ago. Old archives will not be pruned."
      write_status STALE_ALERT "Last success ${age}h ago; new backup failed"
    fi
    return "${status}"
  fi

  dir="$(printf '%s\n' "${output}" | awk '/^Backup written to /{print substr($0,19)}' | tail -n 1)"
  if [[ -z "${dir}" || ! -d "${dir}" ]]; then
    log "ERROR: backup reported success but dump directory was not found"
    write_status LAST_FAILURE "dump directory missing after success"
    return 1
  fi

  if ! validate_dump "${dir}"; then
    write_status LAST_FAILURE "dump failed validation"
    return 1
  fi

  archive="$(compress_dump "${dir}")"
  log "Compressed ${archive}"
  write_status LAST_SUCCESS "compressed ${archive}"
  rm -f "${BACKUP_DIR}/STALE_ALERT"

  prune_old_archives
  cleanup_incomplete_dirs
  log "Backup finished OK"
}

if command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE}"
  if ! flock -n 9; then
    log "Another backup is already running; exiting"
    exit 0
  fi
fi

run_backup
