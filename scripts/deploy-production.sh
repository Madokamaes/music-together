#!/usr/bin/env bash
set -euo pipefail

image_ref="${1:-}"
app_port="${2:-3001}"
container_name="music-together"
lock_path="/var/lock/music-together-deploy.lock"

if [[ -z "$image_ref" ]]; then
  echo "Image reference argument is required." >&2
  exit 2
fi

exec 9>"$lock_path"
if ! flock -w 900 9; then
  echo "Another music-together deployment is still running." >&2
  exit 1
fi

if ss -lntp | grep -E ":${app_port}\b" | grep -v docker >/dev/null; then
  echo "Deployment refused: port ${app_port} is already used by a non-Docker process." >&2
  ss -lntp | grep -E ":${app_port}\b" >&2
  exit 1
fi

docker pull "$image_ref"
docker rm -f "$container_name" 2>/dev/null || true

docker run -d \
  --name "$container_name" \
  --restart unless-stopped \
  -p "${app_port}:3001" \
  "$image_ref"

docker ps --filter "name=$container_name"

for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${app_port}" >/dev/null; then
    echo "music-together is healthy on port ${app_port}."
    exit 0
  fi
  sleep 1
done

echo "music-together health check failed on port ${app_port}." >&2
docker logs --tail=100 "$container_name" >&2 || true
exit 1
