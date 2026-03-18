@echo off
chcp 65001 >nul
title Союз CRM — Установка и запуск

echo.
echo  ╔══════════════════════════════════════╗
echo  ║        Союз CRM — Автозапуск         ║
echo  ╚══════════════════════════════════════╝
echo.

:: Проверка Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ОШИБКА] Node.js не установлен!
    echo.
    echo  Скачай и установи Node.js 20 LTS с сайта:
    echo  https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js найден:
node --version

:: Установка зависимостей
echo.
echo  [1/4] Устанавливаю зависимости...
call npm install
if errorlevel 1 ( echo [ОШИБКА] npm install провалился & pause & exit /b 1 )

:: Создание .env для сервера
echo.
echo  [2/4] Настраиваю окружение...
if not exist "apps\server\.env" (
    copy "apps\server\.env.example" "apps\server\.env" >nul
    echo  Создан apps\server\.env
) else (
    echo  apps\server\.env уже существует — пропускаю
)

:: Создание .env для веба
if not exist "apps\web\.env" (
    echo VITE_API_URL=http://localhost:3000> "apps\web\.env"
    echo  Создан apps\web\.env
) else (
    echo  apps\web\.env уже существует — пропускаю
)

:: Инициализация БД
echo.
echo  [3/4] Инициализирую базу данных...
cd apps\server
call npx prisma db push
if errorlevel 1 ( echo [ОШИБКА] Prisma db push провалился & pause & exit /b 1 )
cd ..\..

:: Запуск серверов
echo.
echo  [4/4] Запускаю серверы...
echo.
echo  Сервер API    → http://localhost:3000
echo  Веб-интерфейс → http://localhost:5173
echo.
echo  Закрой это окно чтобы остановить всё.
echo.

:: Запуск сервера в отдельном окне
start "Союз CRM — Сервер" cmd /k "cd /d %~dp0apps\server && npm run dev"

:: Небольшая пауза чтобы сервер стартанул
timeout /t 4 /nobreak >nul

:: Запуск веба в отдельном окне
start "Союз CRM — Веб" cmd /k "cd /d %~dp0apps\web && npm run dev"

:: Пауза чтобы Vite запустился
timeout /t 5 /nobreak >nul

:: Открыть браузер
start http://localhost:5173

echo  Браузер открыт. Оба окна с серверами работают.
echo  Чтобы остановить — закрой окна "Союз CRM — Сервер" и "Союз CRM — Веб".
echo.
pause
