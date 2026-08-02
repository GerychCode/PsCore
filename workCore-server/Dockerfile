# ==========================================
# Етап розробки (Development)
# ==========================================
FROM node:20-alpine AS development

# tzdata — щоб змінна TZ (Europe/Kyiv) давала коректний локальний час
RUN apk add --no-cache tzdata

# Встановлюємо робочу директорію всередині контейнера
WORKDIR /app

# Копіюємо файли для встановлення залежностей
COPY package*.json ./

# Встановлюємо залежності проекту
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate

# Відкриваємо порт
EXPOSE 3022

# Команда за замовчуванням
CMD ["npm", "run", "start:dev"]


# ==========================================
# Етап продакшену (Production)
# ==========================================
FROM node:20-alpine AS production

# tzdata — щоб змінна TZ (Europe/Kyiv) давала коректний локальний час
RUN apk add --no-cache tzdata

WORKDIR /app

COPY package*.json ./

# Встановлюємо всі залежності
RUN npm install --legacy-peer-deps

COPY . .

# Генеруємо Prisma
RUN npx prisma generate

# Збираємо (білдимо) NestJS додаток для продакшену
RUN npm run build

# SECURITY: не працюємо від root. Каталог uploads має бути записуваним для node.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3022

# Команда буде перевизначена в docker-compose.yml, але залишаємо fallback
CMD ["npm", "run", "start:prod"]