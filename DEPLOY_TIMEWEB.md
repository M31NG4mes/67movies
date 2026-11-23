# Деплой 67movies в России (Timeweb Cloud) с синхронизацией

Этот гайд позволяет поднять российское зеркало **67movies** на **Timeweb Cloud (App Platform)**, чтобы сайт работал в России **без VPN**, а все аккаунты, друзья, чаты, группы и история просмотров были **общими** с основным сайтом (Render / Vercel).

---

## Шаг 1. Подготовьте репозиторий на GitHub
Загрузите обновлённые файлы из папки `67movies-upload` на GitHub (включая `Dockerfile.api`, `Dockerfile.web`, прокси TMDB в `apps/api` и `apps/web`).
> Сначала обновите основной сервис на **Render**, чтобы на `https://six7movies-api.onrender.com` появились маршруты `/api/proxy/tmdb/...` и `/api/proxy/tmdb-image/...`.

---

## Шаг 2. Создайте бэкенд (`67movies-api-ru`) в Timeweb Cloud App Platform
1. Откройте **Timeweb Cloud → App Platform → Создать приложение**.
2. Подключите ваш GitHub-репозиторий.
3. Тип сборки: **Docker** (укажите путь к Dockerfile: `Dockerfile.api`), порт: **`4000`**.
4. Добавьте переменные окружения (**Environment Variables**):
   - `NODE_ENV=production`
   - `PORT=4000`
   - `DATABASE_URL` = **точная копия `DATABASE_URL` с вашего Render** *(благодаря общей БД все пользователи, чаты, группы и история синхронизируются мгновенно!)*
   - `JWT_SECRET` = **точная копия `JWT_SECRET` с Render** *(чтобы токены входа подходили к обоим серверам)*
   - `TMDB_API_KEY` = ваш ключ TMDB
   - `TMDB_BASE_URL=https://six7movies-api.onrender.com/api/proxy/tmdb`
   - `TMDB_IMAGE_BASE_URL=https://six7movies-api.onrender.com/api/proxy/tmdb-image`
   - `CORS_ORIGIN=*` *(или домен вашего российского фронтенда, например `https://67movies-ru.tw1.ru`)*
5. Запустите деплой и скопируйте выданный URL API (например, `https://six7movies-api-ru.tw1.ru`).

---

## Шаг 3. Создайте фронтенд (`67movies-web-ru`) в Timeweb Cloud App Platform
1. Создайте второе приложение в **Timeweb Cloud → App Platform**.
2. Подключите тот же GitHub-репозиторий.
3. Тип сборки: **Docker** (укажите путь к Dockerfile: `Dockerfile.web`), порт: **`3000`**.
4. Добавьте переменные окружения (**и на этапе Build Args, и в Runtime**):
   - `NODE_ENV=production`
   - `NEXT_PUBLIC_API_URL=https://<ваш-api-на-timeweb>/api`
   - `TMDB_API_KEY` = ваш ключ TMDB
   - `TMDB_BASE_URL=https://six7movies-api.onrender.com/api/proxy/tmdb`
   - `NEXT_PUBLIC_TMDB_IMAGE_BASE=https://six7movies-api.onrender.com/api/proxy/tmdb-image`
5. Запустите деплой и при необходимости привяжите свой `.ru` / `.su` домен в настройках Timeweb.

---

## Как это работает
- Пользователь в России открывает сайт на сервере Timeweb напрямую (без VPN).
- Постеры и данные TMDB автоматически загружаются через ваш зарубежный прокси (`six7movies-api.onrender.com/api/proxy/tmdb-image/...`), поэтому не блокируются провайдерами в РФ.
- Запросы входа, чата, друзей и истории идут в российский API на Timeweb, который пишет в **ту же самую базу PostgreSQL**, что и зарубежный сайт.
