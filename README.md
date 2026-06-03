# СпецСинтез — Корпоративный сайт

Промышленный сайт для НПО «СпецСинтез» — производителя профессиональных моющих и дезинфицирующих средств.

---

## Технологии

Node.js, Express.js 5, PostgreSQL 17, EJS, TinyMCE 8, Docker, Gulp, Mocha/Chai

---

## Установка и запуск

### Требования
- Node.js 18+
- PostgreSQL 15+
- npm

### Локальная разработка

```bash
git clone <repo-url>
cd specsintez
npm install
cp .env.example .env   # указать свои данные
createdb -U postgres specsintez
psql -U postgres -d specsintez -f schema.sql
npm start               # http://localhost:5500

Docker:
docker-compose up -d                    # development
docker-compose -f docker-compose.prod.yml up -d  # production

Команды:
npm start	Запуск сервера
npm test	Запуск тестов
npm run build	Сборка CSS/JS бандлов
npm run build:prod	Полная production-сборка

Переменные окружения (.env):
DB_USER=postgres
DB_HOST=localhost
DB_NAME=specsintez
DB_PASSWORD=
DB_PORT=5432
SMTP_HOST=smtp.mail.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=
SMTP_PASS=
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/specsintez_test
PORT=5500
ADMIN_USER=admin
ADMIN_PASS=          # bcrypt hash
SESSION_SECRET=      # random string

Структура проекта:
├── public/                  # Статика
│   ├── css/                 # main, layout, catalog, adaptive, pages/
│   ├── js/                  # main, catalog, main-page, news-public
│   └── admin/               # Админ-панель
├── views/admin/             # EJS-шаблоны
├── routes/admin/            # Роуты админки
├── middleware/               # cache, upload, validation
├── utils/                   # slugify
├── test/                    # Тесты (33 passing)
├── server.js                # Точка входа
├── schema.sql               # Схема БД
├── gulpfile.js
├── build-html.js
└── docker-compose.yml

Админ-панель:
Доступ: /admin (логин и пароль в .env)

Возможности:

    📰 Новости (создание, редактирование, удаление, hero)

    🗂️ Категории (дерево) + направления

    📦 Товары (описание, свойства, галерея изображений)

    🏷️ Типы упаковок

    📝 TinyMCE-редактор



Рекомендуется дополнительно:

    Nginx для проксирования и сжатия gzip

    Let's Encrypt для HTTPS

    Ежедневный бэкап БД (cron + pg_dump)