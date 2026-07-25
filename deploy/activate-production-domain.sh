#!/usr/bin/env bash
set -Eeuo pipefail

EXPECTED_IP="${EXPECTED_IP:-155.212.171.128}"
DOMAINS=(tursbezhimnamore.ru www.tursbezhimnamore.ru)
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run as root with CERTBOT_EMAIL set." >&2
  exit 1
fi

[[ -n "$CERTBOT_EMAIL" ]] || {
  echo "Example: sudo CERTBOT_EMAIL=admin@example.ru bash deploy/activate-production-domain.sh" >&2
  exit 1
}

for command in nginx certbot getent curl; do
  command -v "$command" >/dev/null || { echo "Missing command: $command" >&2; exit 1; }
done

for domain in "${DOMAINS[@]}"; do
  resolved="$(getent ahostsv4 "$domain" | awk 'NR==1{print $1}')"
  if [[ "$resolved" != "$EXPECTED_IP" ]]; then
    echo "$domain resolves to ${resolved:-nothing}, expected $EXPECTED_IP. DNS cutover is not ready." >&2
    exit 1
  fi
done

nginx -t
certbot --nginx --non-interactive --agree-tos --redirect \
  --email "$CERTBOT_EMAIL" \
  -d tursbezhimnamore.ru \
  -d www.tursbezhimnamore.ru
nginx -t
systemctl reload nginx

curl --fail --silent --show-error --head https://tursbezhimnamore.ru/ >/dev/null
curl --fail --silent --show-error --head https://www.tursbezhimnamore.ru/ >/dev/null

echo "Production domain is active over HTTPS."
