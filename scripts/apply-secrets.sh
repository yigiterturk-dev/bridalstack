#!/usr/bin/env bash
# BridalStack — üretim sırlarını yerelden sunucuya aktarır.
#
# Kullanım:
#   scripts/apply-secrets.sh [dosya]
# Varsayılan dosya: ~/.claude/.secrets/bridalstack.env
# Boş değerler atlanır; dolu değerler /opt/bridalstack/.env içine yazılır ya da
# güncellenir, konteyner yeniden oluşturulur ve sağlık kontrolü yapılır.
set -euo pipefail

cd "$(dirname "$0")/.."
HOST="${BRIDALSTACK_HOST:-netcup}"
LOCAL="${1:-$HOME/.claude/.secrets/bridalstack.env}"

[ -r "$LOCAL" ] || { echo "✖ dosya yok: $LOCAL"; exit 1; }

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
grep -E '^[A-Z0-9_]+=.+' "$LOCAL" > "$TMP" || { echo "✖ dosyada dolu değer yok"; exit 1; }

echo "→ aktarılacak anahtarlar:"
cut -d= -f1 "$TMP" | sed 's/^/   - /'

scp -q "$TMP" "$HOST:/tmp/bridalstack-secrets.env"
ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
chmod 600 /tmp/bridalstack-secrets.env
python3 - <<'PY'
keys = {}
for line in open("/tmp/bridalstack-secrets.env"):
    line = line.rstrip("\n")
    if not line or line.startswith("#"):
        continue
    k, _, v = line.partition("=")
    if k and v:
        keys[k] = v

p = "/opt/bridalstack/.env"
lines = open(p).read().splitlines()
out, seen = [], set()
for line in lines:
    k = line.split("=", 1)[0]
    if k in keys:
        out.append(f"{k}={keys[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in keys.items():
    if k not in seen:
        out.append(f"{k}={v}")
open(p, "w").write("\n".join(out) + "\n")
print("yazıldı:", ", ".join(sorted(keys)))
PY
rm -f /tmp/bridalstack-secrets.env
chmod 600 /opt/bridalstack/.env

cd /opt/bridalstack
if ! docker compose -f docker-compose.netcup.yml up -d --force-recreate; then
  docker rm -f bridalstack 2>/dev/null || true
  docker compose -f docker-compose.netcup.yml up -d
fi
sleep 8
echo "→ sağlık: $(curl -s http://172.18.0.1:3224/api/health)"
echo "→ login : $(curl -s -o /dev/null -w '%{http_code}' https://bridalstack.com/login)"
REMOTE

echo "✓ bitti. Doğrulama: /settings'te plan seçici + /forgot-password ile gerçek mail."
