[CmdletBinding()]
param([string]$Configuration = 'Release', [string]$Filter = '')
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskConfigPath = Join-Path $taskRepo 'backend/TutoriaUNAS.Api/appsettings.Development.local.json'
if (-not (Test-Path -LiteralPath $taskConfigPath)) { throw 'Ejecuta primero scripts/Preparar-Postgres.ps1.' }
$taskConfig = Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
$taskConnection = [System.Data.Common.DbConnectionStringBuilder]::new()
$taskConnection.set_ConnectionString($taskConfig.ConnectionStrings.Tutoria)
$taskConnection.set_Item('Database', 'tutoria_unas_tests')
$taskPreviousTestConnection = $env:TUTORIA_TEST_CONNECTION
$taskPreviousConfig = $env:TUTORIA_LOCAL_CONFIG
$taskDotnet = (Get-Command dotnet -ErrorAction Stop).Source
Push-Location (Join-Path $taskRepo 'backend')
try {
    $env:TUTORIA_TEST_CONNECTION = $taskConnection.get_ConnectionString()
    $env:TUTORIA_LOCAL_CONFIG = $null
    $taskTestArgs = @('test', 'TutoriaUNAS.Api.Tests/TutoriaUNAS.Api.Tests.csproj', '--configuration', $Configuration, '--no-restore', '--logger', 'console;verbosity=minimal')
    if ($Filter) { $taskTestArgs += @('--filter', $Filter) }
    & $taskDotnet @taskTestArgs
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas de la API con PostgreSQL.' }
} finally {
    $env:TUTORIA_TEST_CONNECTION = $taskPreviousTestConnection
    $env:TUTORIA_LOCAL_CONFIG = $taskPreviousConfig
    Pop-Location
}
