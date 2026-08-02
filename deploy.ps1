# Деплой PrintStudio на сервер.
#
# Чому tar, а не scp папки: scp шле кожен файл окремим round-trip'ом, і повний
# проєкт (76к файлів) їде годинами. Архів — це ~18 МБ одним потоком.
# Чому не пайп `tar | ssh`: PowerShell 5.1 псує бінарні дані в пайпі між
# нативними програмами, потік приїжджає пошкодженим.
#
# .env НЕ передається навмисно: на сервері свої секрети (пароль БД, токен бота).
# Перший раз його треба покласти вручну — див. README-блок наприкінці файлу.
#
# Використання:
#   .\deploy.ps1                 # залити код і перезібрати
#   .\deploy.ps1 -SkipBuild      # тільки залити файли, без docker compose
#   .\deploy.ps1 -DbPush         # додатково накотити схему Prisma

param(
    [string]$ServerHost = 'ubuntu@51.83.162.224',
    [string]$RemotePath = '~/projects/PsCore',
    [switch]$SkipBuild,
    [switch]$DbPush
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$archive = Join-Path (Split-Path $projectRoot -Parent) 'pscore.tar.gz'

$excludes = @(
    '--exclude=node_modules'
    '--exclude=.next'
    '--exclude=dist'
    '--exclude=.git'
    '--exclude=.idea'
    '--exclude=coverage'
    '--exclude=uploads'   # файли користувачів живуть на сервері
    '--exclude=.claude'
    '--exclude=.env'      # секрети сервера не чіпаємо
)

Write-Host "[1/4] Пакую проєкт..." -ForegroundColor Cyan
Push-Location $projectRoot
if (Test-Path $archive) { Remove-Item $archive -Force }
tar czf $archive @excludes .
Pop-Location
if ($LASTEXITCODE -ne 0) { throw "tar завершився з кодом $LASTEXITCODE" }

$sizeMb = [math]::Round((Get-Item $archive).Length / 1MB, 1)
Write-Host "      $archive — $sizeMb MB" -ForegroundColor DarkGray

Write-Host "[2/4] Копіюю на $ServerHost..." -ForegroundColor Cyan
scp $archive "${ServerHost}:/tmp/pscore.tar.gz"
if ($LASTEXITCODE -ne 0) { throw "scp завершився з кодом $LASTEXITCODE" }

Write-Host "[3/4] Розпаковую на сервері..." -ForegroundColor Cyan
# -C розпаковує поверх наявного: файли перезаписуються, видалені локально
# на сервері лишаються. Для повного дзеркала треба чистити папку вручну.
ssh $ServerHost "mkdir -p $RemotePath && tar xzf /tmp/pscore.tar.gz -C $RemotePath && rm /tmp/pscore.tar.gz && test -f $RemotePath/.env || echo 'УВАГА: .env на сервері відсутній — стек не підніметься'"
if ($LASTEXITCODE -ne 0) { throw "ssh завершився з кодом $LASTEXITCODE" }

if ($SkipBuild) {
    Write-Host "[4/4] Пропущено (-SkipBuild)." -ForegroundColor Yellow
    Write-Host "Готово." -ForegroundColor Green
    exit 0
}

Write-Host "[4/4] Перезбираю контейнери..." -ForegroundColor Cyan
$remoteCmd = "cd $RemotePath && docker compose up -d --build"
if ($DbPush) {
    $remoteCmd += " && docker compose run --rm --no-deps server npx prisma db push && docker compose up -d server"
}
$remoteCmd += " && docker compose ps"
ssh $ServerHost $remoteCmd
if ($LASTEXITCODE -ne 0) { throw "Збірка на сервері впала з кодом $LASTEXITCODE" }

Write-Host "Готово. Клієнт: http://51.83.162.224:1489" -ForegroundColor Green
