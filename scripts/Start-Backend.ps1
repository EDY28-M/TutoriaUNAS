[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
$dotnetExecutable = if ($dotnetCommand) { $dotnetCommand.Source } else { Join-Path $env:USERPROFILE '.dotnet/dotnet.exe' }
if (-not (Test-Path -LiteralPath $dotnetExecutable)) {
    throw 'Instala el SDK .NET 10 para ejecutar la API.'
}

Push-Location $projectRoot
try {
    & $dotnetExecutable restore backend/TutoriaUNAS.slnx --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restaurar las dependencias de la API.' }
    & $dotnetExecutable run --project backend/TutoriaUNAS.Api --launch-profile http
} finally { Pop-Location }
