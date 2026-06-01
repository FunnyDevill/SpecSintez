# ========== Dockerfile ==========
FROM node:18-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем минифицированные CSS/JS бандлы
RUN npm run build

# Удаляем dev-зависимости после сборки
RUN npm prune --production

# Создаём папку для загружаемых файлов
RUN mkdir -p public/uploads

EXPOSE 5500

CMD ["node", "server.js"]