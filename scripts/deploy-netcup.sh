#!/usr/bin/env bash
# BridalStack — netcup deployment.
#
# Ships the tracked tree (git archive) to /opt/bridalstack, rebuilds the image
# and recreates the container. .env, node_modules, .next and .git are never
# touched because they are not part of the archive.
set -euo pipefail

cd "$(dirname "$0")/.."

HOST="${BRIDALSTACK_HOST:-netcup}"
APP_DIR="/opt/bridalstack"
COMPOSE="docker-compose.netcup.yml"

echo "→ kod gönderiliyor ($(git rev-parse --short HEAD))"
git archive --format=tar HEAD | ssh "$HOST" "tar -x -C $APP_DIR"

echo "→ imaj derleniyor ve konteyner yeniden başlatılıyor"
ssh "$HOST" "cd $APP_DIR && docker compose -f $COMPOSE up -d --build"

echo "→ sağlık kontrolü"
sleep 8
ssh "$HOST" "curl -s http://172.18.0.1:3224/api/health; echo"
ssh "$HOST" "curl -s -o /dev/null -w 'login %{http_code}\n' http://172.18.0.1:3224/login"
