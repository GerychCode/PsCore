# ==========================================
# Етап розробки (Development)
# ==========================================
FROM node:20-alpine AS development

# Встановлюємо робочу директорію всередині контейнера
WORKDIR /app

# Копіюємо файли для встановлення залежностей
COPY package*.json ./

# Встановлюємо залежності проекту
RUN npm install --legacy-peer-deps
#
# Копіюємо решту файлів проекту (ВИПРАВЛЕНО ТУТ)
COPY . .

# Генеруємо Prisma клієнт
RUN npx prisma generate

# Відкриваємо порт
EXPOSE 3022

# Команда за замовчуванням
CMD ["npm", "run", "start:dev"]


# ==========================================
# Етап продакшену (Production)
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./

# Встановлюємо всі залежності
RUN npm install

COPY . .

# Генеруємо Prisma
RUN npx prisma generate

# Збираємо (білдимо) NestJS додаток для продакшену
RUN npm run build

EXPOSE 3022

# Команда буде перевизначена в docker-compose.yml, але залишаємо fallback
CMD ["npm", "run", "start:prod"]