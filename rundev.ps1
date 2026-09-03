# RouteWise local development orchestrator for Windows PowerShell.
# Usage:  .\rundev.ps1
#         .\rundev.ps1 -NoMobile
#         .\rundev.ps1 -SkipInstall
#         .\rundev.ps1 -Help

[CmdletBinding()]
param(
    [switch]$NoMobile,
    [switch]$SkipInstall,
    [switch]$ResetDemo,
    [switch]$SkipDocker,
    [switch]$Help
)

$ErrorActionPreference = "Stop"
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Show-Help {
    Write-Host "Usage: .\rundev.ps1 [options]"
    Write-Host ""
    Write-Host "  -NoMobile       Do not start Expo"
    Write-Host "  -SkipInstall    Skip pip/npm installs"
    Write-Host "  -SkipDocker     Skip Docker; use SQLite if Postgres is down"
    Write-Host "  -ResetDemo      Delete and reseed Jefferson Demo data (interactive confirm)"
    Write-Host "  -Help           Show this help"
    Write-Host ""
    Write-Host "Starts PostgreSQL and Redis via Docker Compose, then Django, Celery, Vite,"
    Write-Host "and Expo from their own folders."
    Write-Host ""
    Write-Host "This is the PowerShell equivalent of ./rundev.sh."
    Write-Host "If scripts are disabled, run:  .\rundev.cmd -NoMobile"
}

if ($Help) {
    Show-Help
    exit 0
}

function Test-Command($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-Python {
    if (Test-Command py) { return @("py", "-3") }
    if (Test-Command python) { return @("python") }
    return $null
}

function Invoke-Python {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
    $py = Get-Python
    if (-not $py) { throw "Python is not installed." }
    & $py[0] @($py[1..($py.Length - 1)] + $Args)
}

function Test-PortInUse([int]$Port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $client.ReceiveTimeout = 400
        $client.Connect("127.0.0.1", $Port)
        $client.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-Tcp([string]$HostName, [int]$Port, [int]$TimeoutSec, [string]$Label) {
    $start = Get-Date
    Write-Host "Waiting for $Label at ${HostName}:${Port} ..."
    while ($true) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $client.ReceiveTimeout = 2000
            $client.Connect($HostName, $Port)
            $client.Close()
            Write-Host "$Label is ready."
            return
        } catch {
            if (((Get-Date) - $start).TotalSeconds -gt $TimeoutSec) {
                throw "Timed out waiting for $Label after ${TimeoutSec}s."
            }
            Start-Sleep -Seconds 2
        }
    }
}

function Import-DotEnv([string]$Path) {
    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim("'").Trim('"')
        Set-Item -Path "Env:$key" -Value $val
    }
}

$missing = @()
if (-not (Test-Command docker)) { $missing += "docker" }
if (-not (Test-Command node)) { $missing += "node" }
if (-not (Test-Command npm)) { $missing += "npm" }
if (-not (Get-Python)) { $missing += "python" }

if ($missing.Count -gt 0) {
    Write-Host "Missing required software: $($missing -join ', ')"
    Write-Host ""
    Write-Host "Install from an elevated PowerShell, then restart the terminal:"
    if ($missing -contains "docker") {
        Write-Host "  winget install Docker.DockerDesktop"
        Write-Host "  Then start Docker Desktop and wait until it is running."
    }
    if ($missing -contains "node" -or $missing -contains "npm") {
        Write-Host "  winget install OpenJS.NodeJS.LTS"
    }
    if ($missing -contains "python") {
        Write-Host "  winget install Python.Python.3.12"
    }
    Write-Host ""
    Write-Host "rundev.sh needs Git Bash. This script (rundev.ps1) is the PowerShell equivalent."
    exit 1
}

if (-not (Test-Path "$Root\.env")) {
    Copy-Item "$Root\.env.example" "$Root\.env"
    Write-Host "Created .env from .env.example"
}
Import-DotEnv "$Root\.env"

foreach ($p in 5432, 6379, 8000, 5173) {
    if (Test-PortInUse $p) {
        if (@(5432, 6379) -contains $p) {
            Write-Host "Port $p already in use - assuming existing Postgres/Redis is fine."
        } else {
            Write-Host "Warning: port $p is already in use. The matching service may fail to bind."
        }
    }
}

function Test-DockerReady {
    cmd /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function Wait-DockerEngine {
    if (Test-DockerReady) { return }
    $desktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path $desktop) {
        $proc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
        if (-not $proc) {
            Write-Host "Starting Docker Desktop (first launch can take a few minutes)..."
            Start-Process $desktop
        } else {
            Write-Host "Docker Desktop is open, waiting for the engine..."
        }
    } else {
        throw "Docker Desktop is not installed."
    }
    $start = Get-Date
    while ($true) {
        if (Test-DockerReady) {
            Write-Host "Docker engine is ready."
            return
        }
        if (((Get-Date) - $start).TotalSeconds -gt 45) {
            throw "Docker engine is not ready after 45 seconds."
        }
        $elapsed = [int]((Get-Date) - $start).TotalSeconds
        Write-Host "  still waiting for Docker engine... ${elapsed}s"
        Start-Sleep -Seconds 5
    }
}

Write-Host "==> Waiting for Docker engine"
if ($SkipDocker) {
    Write-Host "Skipping Docker. Django will use SQLite until Postgres is listening on 5432."
} else {
    try {
        Wait-DockerEngine
        Write-Host "==> Starting PostgreSQL and Redis"
        docker compose -f "$Root\infrastructure\docker-compose.yml" --env-file "$Root\.env" up -d
        Wait-Tcp "localhost" 5432 60 "PostgreSQL"
        Wait-Tcp "localhost" 6379 60 "Redis"
    } catch {
        Write-Host $_.Exception.Message
        Write-Host "Docker is not ready. Continuing with SQLite so the web app can start."
        $SkipDocker = $true
    }
}

$Venv = Join-Path $Root "backend\.venv"
$PyExe = Join-Path $Venv "Scripts\python.exe"
if (-not (Test-Path $PyExe)) {
    Write-Host "==> Creating Python virtualenv"
    Invoke-Python -m venv $Venv
}

if (-not $SkipInstall) {
    Write-Host "==> Installing backend dependencies"
    & $PyExe -m pip install -q -r "$Root\backend\requirements.txt"
}

$env:DJANGO_SETTINGS_MODULE = "config.settings.development"
Set-Location "$Root\backend"
& $PyExe manage.py migrate --noinput

if ($ResetDemo) {
    Write-Host "This will delete Jefferson Demo Schools data only, not the whole database."
    $confirm = Read-Host "Type RESET-DEMO to continue"
    if ($confirm -ne "RESET-DEMO") {
        Write-Host "Aborted."
        exit 1
    }
    & $PyExe manage.py seed_demo --reset-demo
} else {
    & $PyExe manage.py seed_demo --skip-if-exists
}

if (-not (Test-Path "$Root\model_artifacts\p50_travel.joblib")) {
    Write-Host "==> Generating and training synthetic ML models"
    & $PyExe manage.py generate_synthetic_ml_data
    & $PyExe manage.py train_travel_models
}

if (-not $SkipInstall) {
    Write-Host "==> Installing web dependencies"
    Set-Location "$Root\web"
    npm install
    if (-not $NoMobile) {
        Write-Host "==> Installing mobile dependencies"
        Set-Location "$Root\mobile"
        npm install
    }
}

New-Item -ItemType Directory -Force -Path "$Root\logs" | Out-Null
$script:ChildProcesses = @()

function Start-LoggedService {
    param([string]$Name, [string]$WorkDir, [string]$FilePath, [string[]]$Arguments)
    $out = Join-Path $Root "logs\$Name.out.log"
    $err = Join-Path $Root "logs\$Name.err.log"
    $p = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkDir `
        -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden
    $script:ChildProcesses += $p
    Start-Job -Name "tail-$Name" -ScriptBlock {
        param($Log, $Label)
        Start-Sleep -Seconds 1
        if (Test-Path $Log) {
            Get-Content $Log -Wait -ErrorAction SilentlyContinue | ForEach-Object { "[$Label] $_" }
        }
    } -ArgumentList $out, $Name | Out-Null
    return $p
}

function Stop-Children {
    Write-Host ""
    Write-Host "==> Stopping RouteWise services"
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue
    foreach ($p in $script:ChildProcesses) {
        if ($p -and -not $p.HasExited) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { } -ErrorAction SilentlyContinue

Write-Host "==> Starting Django"
$django = Start-LoggedService "django" "$Root\backend" $PyExe @("-m", "daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application")

Write-Host "==> Starting Celery"
$celery = Start-LoggedService "celery" "$Root\backend" $PyExe @("-m", "celery", "-A", "config", "worker", "-l", "info", "--pool=solo")

Write-Host "==> Starting Vite"
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = "npm.cmd" }
$vite = Start-LoggedService "vite" "$Root\web" $npmCmd @("run", "dev", "--", "--host")

if (-not $NoMobile) {
    Write-Host "==> Starting Expo"
    $npxCmd = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npxCmd) { $npxCmd = "npx.cmd" }
    Start-LoggedService "expo" "$Root\mobile" $npxCmd @("expo", "start") | Out-Null
}

$lan = "YOUR_LAN_IP"
try {
    $lan = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -ne "WellKnown" -and $_.IPAddress -notlike "127.*" } | Select-Object -First 1 -ExpandProperty IPAddress)
} catch { }

$password = if ($env:DEMO_PASSWORD) { $env:DEMO_PASSWORD } else { "DemoPass123!" }

Write-Host ""
Write-Host "RouteWise is running."
Write-Host ""
Write-Host "  Web UI:     http://localhost:5173"
Write-Host "  API:        http://localhost:8000/api/v1/"
Write-Host "  OpenAPI:    http://localhost:8000/api/docs/"
Write-Host "  Health:     http://localhost:8000/health/"
Write-Host ""
Write-Host "Demo accounts (password: $password)"
Write-Host "  platform@routewise.demo     platform admin"
Write-Host "  admin@jefferson.demo        district admin"
Write-Host "  planner@jefferson.demo      planner"
Write-Host "  dispatcher@jefferson.demo   dispatcher"
Write-Host "  driver@jefferson.demo       driver"
Write-Host "  guardian@jefferson.demo     guardian"
Write-Host ""
Write-Host "Physical phone: Expo Go cannot use localhost. Set EXPO_PUBLIC_API_URL to"
Write-Host "http://${lan}:8000/api/v1 in .env, same Wi-Fi, and allow port 8000."
Write-Host ""
Write-Host "Proof of concept only - not a production student transportation system."
Write-Host "Press Ctrl+C to stop Django, Celery, Vite, and Expo. Docker Postgres/Redis stay up."
Write-Host ""

try {
    while ($true) {
        Receive-Job -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
        if ($django.HasExited -or $vite.HasExited) {
            Write-Host "A required process exited. Check logs/ for details."
            break
        }
        Start-Sleep -Milliseconds 400
    }
} finally {
    Stop-Children
}
