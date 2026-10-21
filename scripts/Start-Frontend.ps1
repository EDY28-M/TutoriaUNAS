[CmdletBinding()]
param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) {
    $nodeDirectory = Join-Path $runtimeRoot 'node/bin'
    if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
        throw 'Instala Node.js 22.12 o superior para ejecutar el frontend.'
    }
    $env:PATH = $nodeDirectory + [IO.Path]::PathSeparator + $env:PATH
}
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$pnpmExecutable = if ($pnpmCommand) { $pnpmCommand.Source } else { Join-Path $runtimeRoot 'bin/fallback/pnpm.cmd' }
if (-not (Test-Path -LiteralPath $pnpmExecutable)) {
    throw 'Instala pnpm 11.25.0 para restaurar las dependencias del frontend.'
}

Push-Location (Join-Path $projectRoot 'frontend')
try {
    if (-not $SkipInstall) {
        & $pnpmExecutable install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron restaurar las dependencias del frontend.' }
    }
    & $pnpmExecutable dev
} finally { Pop-Location }
