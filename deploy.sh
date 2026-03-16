#!/bin/bash
# Деплой союзсрм на cs2casino.space
# Запускать на сервере: ./deploy.sh [--ssl]
# --ssl — настроить HTTPS через certbot

set -e
cd "$(dirname "$0")"
DOMAIN="cs2casino.space"
DO_SSL=false
[[ "$1" == "--ssl" ]] && DO_SSL=true
WEB_ROOT="/var/www/$DOMAIN/web"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN.conf"

echo "==> Сборка проекта..."
npm ci
npm -w apps/server run prisma:generate
npm run build

echo "==> Создание директории для статики..."
sudo mkdir -p "$WEB_ROOT"
sudo cp -r apps/web/dist/* "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT" 2>/dev/null || sudo chown -R nginx:nginx "$WEB_ROOT" 2>/dev/null || true

echo "==> Настройка nginx..."
sudo cp nginx/$DOMAIN.conf "$NGINX_CONF"
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
echo "    nginx перезагружен"

if $DO_SSL; then
  echo "==> Настройка SSL (certbot)..."
  echo "    Укажите email для Let's Encrypt при запросе"
  sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect
  echo "    SSL настроен"
fi

echo "==> Запуск API через PM2..."
command -v pm2 >/dev/null || npm install -g pm2
pm2 delete soyuz-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup 2>/dev/null || echo "    Выполните 'pm2 startup' для автозапуска при перезагрузке"

echo ""
echo "✓ Деплой завершён. Сайт: http://$DOMAIN"
echo ""
echo "Дальше (опционально):"
echo "  1. SSL: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  2. Проверьте apps/server/.env (DATABASE_URL, JWT_SECRET, CORS_ORIGIN)"
echo "  3. CORS_ORIGIN для production: https://$DOMAIN,https://t.me"
