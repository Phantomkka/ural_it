#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${NETCITY_ENV_FILE:-$repo_dir/deploy/local/.env}"
if [ ! -f "$env_file" ]; then echo 'Set NETCITY_ENV_FILE or run deploy/init.sh first.' >&2; exit 1; fi
# Explicitly use this machine's daemon; never follow an inherited remote Docker context.
docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
compose() { docker_local compose --env-file "$env_file" -f "$repo_dir/deploy/compose.yaml" "$@"; }
case "${1:-status}" in
  config) compose config --quiet ;;
  build) compose build --pull ;;
  up) compose config --quiet; compose up -d --build --wait --wait-timeout 120 ;;
  start) compose config --quiet; compose up -d --wait --wait-timeout 120 ;;
  status) compose ps --all ;;
  logs) compose logs --tail 100 ;;
  stop) compose stop ;;
  restart-server) compose restart server ;;
  backup)
    backup_dir="${NETCITY_BACKUP_DIR:-$repo_dir/deploy/backups}"
    umask 077
    mkdir -p "$backup_dir"
    dump_file="$(mktemp "$backup_dir/netcity-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump")"
    if compose exec -T db sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$dump_file"; then
      printf 'Backup saved: %s\n' "$dump_file"
    else
      rm -f "$dump_file"
      echo 'Backup failed; the database was not changed.' >&2
      exit 1
    fi
    ;;
  *) echo 'Usage: manage.sh {config|build|up|start|status|logs|stop|restart-server|backup}' >&2; exit 2 ;;
esac
