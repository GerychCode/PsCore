#!/bin/sh
# Бекап PrintStudio: база + завантаження користувачів.
#
# Встановлення на сервері (щодня о 03:30):
#   chmod +x ~/projects/PsCore/scripts/backup.sh
#   crontab -e
#   30 3 * * * /home/ubuntu/projects/PsCore/scripts/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# Відновлення бази:
#   gunzip -c pscore-2026-07-25.sql.gz | docker compose exec -T postgres \
#     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

set -eu

PROJECT_DIR="${PROJECT_DIR:-$HOME/projects/PsCore}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

STAMP=$(date +%F)
mkdir -p "$BACKUP_DIR"
cd "$PROJECT_DIR"

echo "[$(date +'%F %T')] Бекап почато"

# --- База ---
# pg_dump усередині контейнера: креденшли беремо з його ж оточення, щоб
# не дублювати їх у скрипті й не розсинхронізувати після зміни пароля.
DB_FILE="$BACKUP_DIR/pscore-$STAMP.sql.gz"
docker compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$DB_FILE"

# Порожній дамп — це збій, а не бекап. Краще впасти голосно.
if [ ! -s "$DB_FILE" ] || [ "$(stat -c%s "$DB_FILE")" -lt 1000 ]; then
  echo "ПОМИЛКА: дамп бази підозріло малий ($DB_FILE) — перевірте контейнер"
  exit 1
fi
echo "  база:     $(du -h "$DB_FILE" | cut -f1)"

# --- Завантаження ---
# Читаємо з тому через тимчасовий контейнер: працює й тоді, коли сервер лежить.
UP_FILE="$BACKUP_DIR/uploads-$STAMP.tar.gz"
if docker volume inspect pscore_uploads_data >/dev/null 2>&1; then
  docker run --rm -v pscore_uploads_data:/data:ro -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/uploads-$STAMP.tar.gz" -C /data . 2>/dev/null
  echo "  uploads:  $(du -h "$UP_FILE" | cut -f1)"
else
  echo "  uploads:  тому ще немає — пропущено"
fi

# --- Ротація ---
find "$BACKUP_DIR" -name 'pscore-*.sql.gz' -mtime "+$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "[$(date +'%F %T')] Готово. Зберігаємо $KEEP_DAYS днів."
echo "УВАГА: копії лежать на тому ж сервері. Втрата машини = втрата бекапів."
echo "Раз на тиждень забирайте dump до себе: scp ubuntu@СЕРВЕР:~/backups/*.gz ."
