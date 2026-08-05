#!/usr/bin/env bash
set -euo pipefail

image_ref="${1:-}"
app_port="${2:-3001}"
container_name="music-together"
volume_name="music-together-data"
env_file="/opt/music-together/.env"
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
docker volume create "$volume_name" >/dev/null
docker rm -f "$container_name" 2>/dev/null || true

env_args=()
if [[ -f "$env_file" ]]; then
  env_args+=(--env-file "$env_file")
fi

docker run -d \
  --name "$container_name" \
  --restart unless-stopped \
  --log-driver local \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -p "${app_port}:3001" \
  -e DATA_DIR=/app/data \
  -v "${volume_name}:/app/data" \
  "${env_args[@]}" \
  "$image_ref"

docker ps --filter "name=$container_name"

healthy=false
for attempt in {1..30}; do
  if curl -fsS "http://127.0.0.1:${app_port}" >/dev/null; then
    healthy=true
    break
  fi
  sleep 1
done

if [[ "$healthy" != true ]]; then
  echo "music-together health check failed on port ${app_port}." >&2
  docker logs --tail=100 "$container_name" >&2 || true
  exit 1
fi

echo "music-together is healthy on port ${app_port}."

# Retain the current image and two previous images from this application only.
# Old SHA-tagged images otherwise accumulate after every deployment.
image_repository="${image_ref%:*}"
current_image_id="$(docker inspect --format '{{.Image}}' "$container_name")"
mapfile -t image_ids < <(docker image ls --no-trunc --quiet "$image_repository" | sort -u)
if (( ${#image_ids[@]} > 3 )); then
  declare -A retained_images=( ["$current_image_id"]=1 )
  retained_count=0
  while read -r image_id _created_at; do
    [[ "$image_id" == "$current_image_id" ]] && continue
    retained_images["$image_id"]=1
    ((retained_count += 1))
    (( retained_count == 2 )) && break
  done < <(docker image inspect --format '{{.Id}} {{.Created}}' "${image_ids[@]}" | sort -rk2)

  for image_id in "${image_ids[@]}"; do
    [[ -n "${retained_images[$image_id]:-}" ]] && continue
    docker image rm "$image_id" >/dev/null || true
  done
fi
