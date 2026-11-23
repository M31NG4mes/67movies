#!/usr/bin/env bash
set -euo pipefail

# Автообновление 67movies на домашнем Linux-сервере из GitHub (ветка main)
# Использование: ./scripts/auto-update-linux.sh
# Для автозапуска раз в 2 минуты добавьте в crontab:
# */2 * * * * /путь/к/67movies/scripts/auto-update-linux.sh >> /var/log/67movies-update.log 2>&1

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.home.yml}"
ENV_FILE="${ENV_FILE:-.env.home}"
LOCK_FILE="/tmp/67movies-auto-update.lock"

cd "$REPO_DIR"

# Защита от наложения двух сборок одновременно
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  exit 0
fi

# Определяем команду docker compose (v2 или v1)
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "[$(date '+%F %T')] ОШИБКА: docker compose не найден"
  exit 1
fi

git fetch origin "$BRANCH" --quiet

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  # Новых коммитов нет — выходим тихо
  exit 0
fi

echo "[$(date '+%F %T')] Найдено обновление: $LOCAL_SHA -> $REMOTE_SHA"

# Обновляем код до состояния ветки на GitHub (не трогая .env.home и untracked файлы)
git pull --ff-only origin "$BRANCH" || {
  echo "[$(date '+%F %T')] Обычный pull не прошёл (локальные правки), выполняю reset --hard origin/$BRANCH"
  git reset --hard "origin/$BRANCH"
}

echo "[$(date '+%F %T')] Пересборка и перезапуск контейнеров..."
if [ -f "$ENV_FILE" ]; then
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build --remove-orphans
else
  "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --build --remove-orphans
fi

# Чистим старые неиспользуемые образы, чтобы не забивать диск
docker image prune -f >/dev/null 2>&1 || true

echo "[$(date '+%F %T')] Обновление успешно завершено ($REMOTE_SHA)"
