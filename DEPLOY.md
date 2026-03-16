# Деплой на cs2casino.space

## Требования на сервере

- Node.js 18+
- nginx
- PM2 (`npm i -g pm2`)
- Для SSL: certbot

## Быстрый старт

1. **Скопируйте проект на сервер** (git clone или scp).

2. **Создайте `apps/server/.env`** на основе `apps/server/.env.production.example`:
   ```bash
   cp apps/server/.env.production.example apps/server/.env
   # Отредактируйте .env: JWT_SECRET, BOT_TOKEN, CORS_ORIGIN
   ```

3. **Запустите деплой:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **SSL (HTTPS):**
   ```bash
   ./deploy.sh --ssl
   ```
   Или вручную: `sudo certbot --nginx -d cs2casino.space -d www.cs2casino.space`

## Что делает deploy.sh

- Собирает проект (server + web)
- Копирует статику в `/var/www/cs2casino.space/web`
- Настраивает nginx (отключает default, включает конфиг для домена)
- Запускает API через PM2 на порту 3000

## Важные переменные в apps/server/.env

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Путь к SQLite или PostgreSQL URL |
| `JWT_SECRET` | Секрет для JWT (минимум 32 символа) |
| `CORS_ORIGIN` | `https://cs2casino.space` (и `https://t.me` для Telegram WebApp) |
| `BOT_TOKEN` | Токен Telegram-бота (если используется) |

## Обновление

```bash
git pull
./deploy.sh
```
