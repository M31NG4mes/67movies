# Бесплатный хостинг 67movies на домашнем Linux-ПК

Запуск на своём компьютере на Linux (Ubuntu / Debian / Mint) полностью бесплатный, не «засыпает» и работает заметно быстрее бесплатного Render.

---

## Шаг 1. Установите Docker на Linux
Выполните в терминале:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```
*(После этого перезайдите в систему или выполните `newgrp docker`.)*

---

## Шаг 2. Скачайте проект и настройте `.env.home`
```bash
git clone https://github.com/M31NG4mes/67movies.git
cd 67movies
cp .env.home.example .env.home
nano .env.home
```
В `.env.home` обязательно укажите:
- `DATABASE_URL` и `JWT_SECRET` (те же самые, что на Render — тогда аккаунты, чаты и история будут общими).
- `NEXT_PUBLIC_API_URL` (публичный адрес вашего API, см. Шаг 3).

---

## Шаг 3. Как открыть сайт в интернет (без белого IP)

### Вариант А: Бесплатный Cloudflare Tunnel (рекомендуется для 24/7)
1. Зарегистрируйтесь на [dash.cloudflare.com](https://dash.cloudflare.com) и добавьте свой домен (в бесплатный тариф Zero Trust входит туннель).
2. Установите `cloudflared` на Linux:
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   ```
3. В Cloudflare Zero Trust → **Networks → Tunnels → Create a tunnel** создайте туннель и добавьте 2 правила:
   - `ваш-домен.ru` → `http://localhost:3000`
   - `api.ваш-домен.ru` → `http://localhost:4000`
4. Запустите команду установки сервиса, которую покажет Cloudflare. В `.env.home` укажите:
   `NEXT_PUBLIC_API_URL=https://api.ваш-домен.ru/api`

### Вариант Б: Быстрый тест без домена (временные ссылки)
Можно запустить два бесплатных временных туннеля:
```bash
cloudflared tunnel --url http://localhost:4000
cloudflared tunnel --url http://localhost:3000
```
Скопируйте выданную `https://...trycloudflare.com` ссылку для порта `4000`, впишите в `.env.home` как `NEXT_PUBLIC_API_URL=https://.../api` и пересоберите `web`.

---

## Шаг 4. Запуск сайта одной командой
```bash
docker compose -f docker-compose.home.yml --env-file .env.home up -d --build
```
Проверить статус:
```bash
docker compose -f docker-compose.home.yml ps
```
Посмотреть логи:
```bash
docker compose -f docker-compose.home.yml logs -f
```
Остановить сервер:
```bash
docker compose -f docker-compose.home.yml down
```

---

## Шаг 5. Автообновление с GitHub (чтобы сервер сам подтягивал новые файлы)

На домашнем Linux-ПК Docker сам не следит за GitHub. Чтобы сервер **автоматически** проверял новые коммиты раз в 2 минуты и сам пересобирал сайт, выполните в папке проекта:

```bash
sed -i 's/\r$//' scripts/auto-update-linux.sh
chmod +x scripts/auto-update-linux.sh
```

И добавьте задачу в `cron`:
```bash
(crontab -l 2>/dev/null | grep -v "auto-update-linux.sh"; echo "*/2 * * * * $(pwd)/scripts/auto-update-linux.sh >> $HOME/67movies-update.log 2>&1") | crontab -
```

Проверить, как работает автообновление (логи):
```bash
tail -f ~/67movies-update.log
```
Запустить обновление вручную прямо сейчас:
```bash
./scripts/auto-update-linux.sh
```
