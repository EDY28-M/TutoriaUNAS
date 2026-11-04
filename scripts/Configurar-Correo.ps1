<# Configura Gmail STARTTLS y protege la contraseña con Data Protection/DPAPI. No envía correos. #>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Usuario,
    [Parameter(Mandatory)][Security.SecureString]$Password,
    [string]$UrlAcceso = 'http://127.0.0.1:5173/login',
    [switch]$SkipConnectionCheck
)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskConfigPath = Join-Path $taskRepo 'backend/TutoriaUNAS.Api/appsettings.Development.local.json'
if (-not (Test-Path -LiteralPath $taskConfigPath)) { throw 'Prepara PostgreSQL y la configuración local antes de configurar el correo.' }
$taskConfigOriginal = Get-Content -LiteralPath $taskConfigPath -Raw
$taskConfig = $taskConfigOriginal | ConvertFrom-Json
# Conservar la capacidad de la aplicación y las ACL privadas del perfil de Windows.
# DPAPI protege el contenido aunque un proceso pueda leer el archivo cifrado.
$taskKey = if ($taskConfig.Cuentas -and $taskConfig.Cuentas.CodigoKey) { $taskConfig.Cuentas.CodigoKey } else {
    $taskBytes = New-Object byte[] 32; $taskRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $taskRandom.GetBytes($taskBytes); [Convert]::ToBase64String($taskBytes) } finally { $taskRandom.Dispose() }
}
$taskConfig | Add-Member -MemberType NoteProperty -Name Cuentas -Force -Value ([ordered]@{
    Enabled = $true; DisableDispatcher = $false; Dominios = @('unas.edu.pe'); CodigoKey = $taskKey
    KeyRingPath = ''; UrlAcceso = $UrlAcceso
})
$taskConfig | Add-Member -MemberType NoteProperty -Name SmtpCuentas -Force -Value ([ordered]@{
    Host = 'smtp.gmail.com'; Port = 587; Usuario = $Usuario; Remitente = $Usuario; Nombre = 'Tutoría UNAS'
    PasswordFile = (Join-Path $taskRepo 'backend/TutoriaUNAS.Api/smtp-password.local.json')
})
$taskOldPassword = $env:TUTORIA_SMTP_PASSWORD
$taskOldUser = $env:TUTORIA_SMTP_USER
$taskOldEnvironment = $env:ASPNETCORE_ENVIRONMENT
$taskOldConfig = $env:TUTORIA_LOCAL_CONFIG
try {
    $env:TUTORIA_SMTP_PASSWORD = ([Net.NetworkCredential]::new('', $Password)).Password -replace ' ', ''
    $env:TUTORIA_SMTP_USER = $Usuario
    if (-not $SkipConnectionCheck) {
        $taskPython = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
        if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Falta el runtime Python para comprobar la conexión SMTP.' }
        & $taskPython -B -c 'import smtplib,ssl,os; s=smtplib.SMTP("smtp.gmail.com",587,timeout=20); s.ehlo(); s.starttls(context=ssl.create_default_context()); s.ehlo(); s.login(os.environ["TUTORIA_SMTP_USER"],os.environ["TUTORIA_SMTP_PASSWORD"]); s.quit(); print("SMTP autenticado mediante TLS. No se enviaron mensajes.")'
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo autenticar SMTP. La configuración anterior se conserva.' }
    }
    [IO.File]::WriteAllText($taskConfigPath, ($taskConfig | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    $taskApi = Join-Path $taskRepo 'backend/TutoriaUNAS.Api/bin/Accounts/net10.0/TutoriaUNAS.Api.exe'
    if (-not (Test-Path -LiteralPath $taskApi)) { throw 'Compila el proyecto de la API con --configuration Accounts antes de proteger SMTP.' }
    $env:ASPNETCORE_ENVIRONMENT = 'Development'; $env:TUTORIA_LOCAL_CONFIG = $taskConfigPath
    & $taskApi --protect-smtp
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo proteger la contraseña SMTP.' }
    Write-Output 'Correo configurado. El secreto SMTP está cifrado en un archivo local excluido de Git y de la publicación.'
} catch {
    [IO.File]::WriteAllText($taskConfigPath, $taskConfigOriginal, [Text.UTF8Encoding]::new($false))
    throw
} finally {
    $env:TUTORIA_SMTP_PASSWORD = $taskOldPassword; $env:TUTORIA_SMTP_USER = $taskOldUser
    $env:ASPNETCORE_ENVIRONMENT = $taskOldEnvironment; $env:TUTORIA_LOCAL_CONFIG = $taskOldConfig
}
