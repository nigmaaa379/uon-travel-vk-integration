# Production security hardening

No internet-facing service can be guaranteed impossible to compromise. This project uses defense in depth and still requires secure server operation.

## Required perimeter

1. Expose only TCP 22, 80 and 443 in the firewall. Docker port 3000 must remain bound to `127.0.0.1`.
2. Use SSH keys; disable password authentication and direct root login after confirming key access.
3. Install unattended security updates and fail2ban.
4. Serve the app only behind Nginx with a valid certificate.
5. Restrict `/admin` and `/api/admin/` by VPN or an IP allowlist whenever possible.

## Nginx baseline

```nginx
limit_req_zone $binary_remote_addr zone=site_leads:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=admin:10m rate=10r/m;
limit_conn_zone $binary_remote_addr zone=perip:10m;

server {
    listen 443 ssl http2;
    server_name tursbezhimnamore.ru www.tursbezhimnamore.ru;

    client_max_body_size 256k;
    server_tokens off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location = /health {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:3000;
    }

    location /api/site/leads {
        limit_req zone=site_leads burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location ~ ^/(admin|api/admin/) {
        limit_req zone=admin burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }

    location / {
        limit_conn perip 30;
        proxy_pass http://127.0.0.1:3000;
        include proxy_params;
    }
}
```

Ensure `proxy_params` overwrites `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`. Do not append untrusted client values without an explicitly trusted proxy chain.

## Secrets

Generate separate values for every secret. Minimum 32 random bytes, for example:

```bash
openssl rand -base64 48
```

Rotate `ADMIN_PASSWORD`, `CONSENT_EVIDENCE_SECRET`, all webhook secrets, bot tokens, SMTP password and U-ON/Tourvisor keys after any suspected disclosure. Never reuse the admin password as a webhook or HMAC secret.

## Backups and personal data

Back up the Docker volume containing `/app/data/store.json` at least daily. Encrypt backups, keep a short retention period matching the legal retention policy, and test restoration. The file must remain mode `0600` and must never be copied to Git or a public cloud bucket without encryption.

## Deployment verification

```bash
sudo ufw status verbose
sudo ss -lntp
sudo nginx -t
curl -I https://tursbezhimnamore.ru/
curl -I https://tursbezhimnamore.ru/admin
curl -sS http://127.0.0.1:3000/health
```

Expected: port 3000 listens only on loopback, HTTP redirects to HTTPS, security headers are present, and the health endpoint is not public.
