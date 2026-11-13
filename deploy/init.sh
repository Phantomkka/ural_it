#!/usr/bin/env bash
set -euo pipefail
if [ "$(id -u)" = 0 ]; then
  echo 'Run configuration creation as the deployment user, not root.' >&2
  exit 1
fi
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
deploy_dir="$(realpath -m "${1:-$repo_dir/deploy/local}")"
if [ -e "$deploy_dir" ]; then
  echo 'Configuration directory already exists; credentials were not changed. Choose a new directory for a fresh instance.' >&2
  exit 1
fi
umask 077
mkdir -p "$(dirname "$deploy_dir")"
mkdir -m 700 "$deploy_dir"
head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$deploy_dir/postgres_password"
printf '\n' >> "$deploy_dir/postgres_password"
cat > "$deploy_dir/.env" <<CONFIG
NETCITY_PROJECT_NAME=netcity-online
NETCITY_SITE=localhost
NETCITY_BIND=127.0.0.1
NETCITY_HTTP_PORT=18080
NETCITY_HTTPS_PORT=18443
NETCITY_RELEASE=local
NETCITY_UID=$(id -u)
NETCITY_GID=$(id -g)
POSTGRES_USER=netcity
POSTGRES_DB=netcity
NETCITY_SECRET_FILE=$deploy_dir/postgres_password
CONFIG
printf 'Configuration created in %s. No password was printed. Edit .env for the approved domain and ports.\n' "$deploy_dir"
