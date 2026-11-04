[CmdletBinding()]
param([ValidateRange(0,65535)][int]$Port = 0)
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$taskFrontendEnv = Join-Path $projectRoot 'frontend/.env.local'
if ($Port -eq 0 -and (Test-Path -LiteralPath $taskFrontendEnv)) {
    $taskApiLine = Get-Content -LiteralPath $taskFrontendEnv | Where-Object { $_ -match '^VITE_API_BASE_URL=' } | Select-Object -First 1
    if ($taskApiLine) {
        $taskApiUri = [Uri]($taskApiLine -replace '^VITE_API_BASE_URL=', '')
        if ($taskApiUri.IsLoopback -and $taskApiUri.Scheme -eq 'http') { $Port = $taskApiUri.Port }
    }
}
if ($Port -eq 0) { $Port = 5080 }
$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetExecutable = if ($dotnetCommand) { $dotnetCommand.Source } else { Join-Path $env:USERPROFILE '.dotnet/dotnet.exe' }
if (-not (Test-Path -LiteralPath $dotnetExecutable)) {
    throw 'Instala el SDK .NET 10 para ejecutar la API.'
}

Push-Location $projectRoot
$taskPreviousConfig = $env:TUTORIA_LOCAL_CONFIG
try {
    $taskLocalConfig = Join-Path $projectRoot 'backend/TutoriaUNAS.Api/appsettings.Development.local.json'
    if (Test-Path -LiteralPath $taskLocalConfig) { $env:TUTORIA_LOCAL_CONFIG = $taskLocalConfig }
    & $dotnetExecutable restore backend/TutoriaUNAS.slnx --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restaurar las dependencias de la API.' }
    & $dotnetExecutable run --project backend/TutoriaUNAS.Api --launch-profile http -- --urls "http://127.0.0.1:$Port"
} finally { $env:TUTORIA_LOCAL_CONFIG = $taskPreviousConfig; Pop-Location }
