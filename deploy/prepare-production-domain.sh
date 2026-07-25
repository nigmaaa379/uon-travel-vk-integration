#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/uon-travel-vk-integration}"
SITE_NAME="tursbezhimnamore.ru"
SOURCE_CONF="$APP_DIR/deploy/nginx/$SITE_NAME.conf"
TARGET_CONF="/etc/nginx/sites-available/$SITE_NAME.conf"
ENABLED_CONF="/etc/nginx/sites-enabled/$SITE_NAME.conf"
REQUIRED_HOSTS="tursbezhimnamore.ru,www.tursbezhimnamore.ru,test.tursbezhimnamore.ru,127.0.0.1,localhost"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root: sudo bash $APP_DIR/deploy/prepare-production-domain.sh" >&2
  exit 1
fi

for command in nginx docker grep install; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done

[[ -f "$SOURCE_CONF" ]] || { echo "Missing $SOURCE_CONF" >&2; exit 1; }
[[ -f "$APP_DIR/.env" ]] || { echo "Missing $APP_DIR/.env" >&2; exit 1; }

grep -q '^TRUST_PROXY=true$' "$APP_DIR/.env" || {
  echo "Set TRUST_PROXY=true in $APP_DIR/.env before continuing." >&2
  exit 1
}

allowed_hosts="$(grep -E '^ALLOWED_HOSTS=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- || true)"
for host in tursbezhimnamore.ru www.tursbezhimnamore.ru; do
  [[ ",$allowed_hosts," == *",$host,"* ]] || {
    echo "Add $host to ALLOWED_HOSTS in $APP_DIR/.env." >&2
    echo "Recommended: ALLOWED_HOSTS=$REQUIRED_HOSTS" >&2
    exit 1
  }
done

cd "$APP_DIR"
docker compose up -d --build
curl --fail --silent --show-error http://127.0.0.1:3000/health >/dev/null

install -o root -g root -m 0644 "$SOURCE_CONF" "$TARGET_CONF"
ln -sfn "$TARGET_CONF" "$ENABLED_CONF"
nginx -t
systemctl reload nginx

echo "Server is ready to receive HTTP traffic for tursbezhimnamore.ru and www.tursbezhimnamore.ru."
echo "Do not switch DNS until the current site is backed up and the cutover is approved."
echo "After DNS points both names to 155.212.171.128, run deploy/activate-production-domain.sh."
