#!/bin/sh
set -eu

: "${BACKUP_REPOSITORY:?BACKUP_REPOSITORY is required}"
: "${BACKUP_ENCRYPTION_PASSWORD:?BACKUP_ENCRYPTION_PASSWORD is required}"

export RESTIC_REPOSITORY="$BACKUP_REPOSITORY"
export RESTIC_PASSWORD="$BACKUP_ENCRYPTION_PASSWORD"

restic snapshots >/dev/null 2>&1 || restic init
restic backup /data/medical /staging --tag valve-course-complete
restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
restic check --read-data-subset=5%
