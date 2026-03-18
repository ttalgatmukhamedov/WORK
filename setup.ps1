# Союз CRM — Автоустановка и запуск (PowerShell)
# Запускать от имени: правой кнопкой -> "Выполнить с помощью PowerShell"
# Если скрипт блокируется: powershell -ExecutionPolicy Bypass -File setup.ps1

$Host.UI.RawUI.WindowTitle = "Союз CRM — Установка"
$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n ► $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "   [OK] $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "   [ОШИБКА] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "   $msg" -ForegroundColor Gray }

Clear-Host
Write-Host ""
Write-Host " ╔══════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host " ║          Союз CRM — Автоустановка         ║" -ForegroundColor Blue
Write-Host " ╚══════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ─── 1. Проверка Node.js ────────────────────────────────────────────────────
Write-Step "Проверяю Node.js..."
try {
    $nodeVer = node --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Write-OK "Node.js найден: $nodeVer"
} catch {
    Write-Err "Node.js не установлен!"
    Write-Host ""
    Write-Host "   Попытка установить через winget..." -ForegroundColor Yellow

    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Info "Устанавливаю Node.js LTS через winget..."
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        # Обновляем PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
        $nodeVer = node --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-OK "Node.js установлен: $nodeVer"
        } else {
            Write-Err "winget установил, но node не найден. Перезапусти PowerShell и снова запусти скрипт."
            Read-Host "Нажми Enter для выхода"
            exit 1
        }
    } else {
        Write-Host ""
        Write-Host "   ❌ winget тоже не найден. Сделай вручную:" -ForegroundColor Red
        Write-Host "      1. Открой браузер и зайди на: https://nodejs.org" -ForegroundColor Yellow
        Write-Host "      2. Нажми зелёную кнопку 'LTS'" -ForegroundColor Yellow
        Write-Host "      3. Установи Node.js" -ForegroundColor Yellow
        Write-Host "      4. Снова запусти этот скрипт" -ForegroundColor Yellow
        Write-Host ""
        Start-Process "https://nodejs.org"
        Read-Host "Нажми Enter для выхода"
        exit 1
    }
}

# ─── 2. Установка зависимостей ──────────────────────────────────────────────
Write-Step "Устанавливаю зависимости..."
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectDir

if (-not (Test-Path "node_modules")) {
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Err "npm install провалился"; Read-Host; exit 1 }
    Write-OK "Зависимости установлены"
} else {
    Write-OK "node_modules уже есть — пропускаю"
}

# ─── 3. Настройка .env ──────────────────────────────────────────────────────
Write-Step "Настраиваю конфигурацию..."

$serverEnv = "apps\server\.env"
$webEnv    = "apps\web\.env"

if (-not (Test-Path $serverEnv)) {
    Copy-Item "apps\server\.env.example" $serverEnv
    Write-OK "Создан $serverEnv"
} else {
    Write-OK "$serverEnv уже существует"
}

if (-not (Test-Path $webEnv)) {
    "VITE_API_URL=http://localhost:3000" | Set-Content $webEnv -Encoding UTF8
    Write-OK "Создан $webEnv"
} else {
    Write-OK "$webEnv уже существует"
}

# ─── 4. Инициализация базы данных ───────────────────────────────────────────
Write-Step "Инициализирую базу данных SQLite..."
Set-Location "apps\server"
npx prisma db push
if ($LASTEXITCODE -ne 0) { Write-Err "Prisma db push провалился"; Set-Location $projectDir; Read-Host; exit 1 }
Write-OK "База данных готова"
Set-Location $projectDir

# ─── 5. Запуск серверов ─────────────────────────────────────────────────────
Write-Step "Запускаю серверы..."

$serverPath = Join-Path $projectDir "apps\server"
$webPath    = Join-Path $projectDir "apps\web"

# Запуск API сервера
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k title [Союз CRM] Сервер API && cd /d `"$serverPath`" && npm run dev" `
    -WindowStyle Normal

Write-Info "Сервер API запускается на http://localhost:3000 ..."
Start-Sleep -Seconds 5

# Запуск веб
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/k title [Союз CRM] Веб && cd /d `"$webPath`" && npm run dev" `
    -WindowStyle Normal

Write-Info "Веб-приложение запускается на http://localhost:5173 ..."
Start-Sleep -Seconds 6

# ─── 6. Открываем браузер ───────────────────────────────────────────────────
Write-Step "Открываю браузер..."
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host " ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host " ║              ГОТОВО!                      ║" -ForegroundColor Green
Write-Host " ║                                           ║" -ForegroundColor Green
Write-Host " ║  Сайт: http://localhost:5173              ║" -ForegroundColor Green
Write-Host " ║  API:  http://localhost:3000              ║" -ForegroundColor Green
Write-Host " ║                                           ║" -ForegroundColor Green
Write-Host " ║  DEV вход:                                ║" -ForegroundColor Green
Write-Host " ║    Токен: dev-token                       ║" -ForegroundColor Green
Write-Host " ║    ID: любые цифры (напр. 123456)         ║" -ForegroundColor Green
Write-Host " ║    Роль: Руководитель                     ║" -ForegroundColor Green
Write-Host " ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host " Закрой окна '[Союз CRM] Сервер API' и '[Союз CRM] Веб' чтобы остановить." -ForegroundColor Gray
Write-Host ""
Read-Host "Нажми Enter для выхода из установщика"
