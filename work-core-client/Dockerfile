# Використовуємо той самий базовий образ
FROM node:20-alpine AS development

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо файли для встановлення залежностей
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо решту файлів (ВИПРАВЛЕНО ТУТ)
COPY . .

# Відкриваємо порт для Next.js dev-сервера
EXPOSE 3000

# Команда за замовчуванням для запуску
CMD ["npm", "run", "dev"]


# ==========================================
# Етап продакшену (Production)
# ==========================================
# Сторінки збираються наперед під час білда (next build),
# тому перше відкриття не чекає компіляції, як у dev-режимі.
FROM node:20-alpine AS production

RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# NEXT_PUBLIC_* запікаються у бандл під час білда, тому хост API
# передається build-арґом з docker-compose (з кореневого .env),
# інакше лишиться localhost з .env.local
ARG NEXT_PUBLIC_SERVER_PROTOCOL=http
ARG NEXT_PUBLIC_SERVER_HOST=127.0.0.1
ARG NEXT_PUBLIC_SERVER_PORT=3022
ARG NEXT_PUBLIC_SERVER_FILE_FOLDER=uploads
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_PROTOCOL}://${NEXT_PUBLIC_SERVER_HOST}:${NEXT_PUBLIC_SERVER_PORT}
ENV NEXT_PUBLIC_SERVER_FILE_STORAGE_PATH=${NEXT_PUBLIC_SERVER_URL}/${NEXT_PUBLIC_SERVER_FILE_FOLDER}

RUN npm run build

# SECURITY: запускаємо не від root
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "start"]