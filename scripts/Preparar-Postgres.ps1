[CmdletBinding()]
param([int]$Port = 5449)
$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskRoot = Join-Path $env:LOCALAPPDATA 'TutoriaUNAS/postgresql-18.6'
$taskBin = Join-Path $taskRoot 'pgsql/bin'
$taskData = Join-Path $taskRoot 'data'
$taskSecrets = Join-Path $taskRoot 'credenciales.local.json'
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $taskBin 'postgres.exe'))) {
    $taskZip = Join-Path $taskRoot 'postgresql.zip'
    if (-not (Test-Path -LiteralPath $taskZip)) {
        Invoke-WebRequest -Uri 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609' -OutFile $taskZip
    }
    Expand-Archive -LiteralPath $taskZip -DestinationPath $taskRoot
}
if (Test-Path -LiteralPath $taskSecrets) {
    $taskCredentials = Get-Content -LiteralPath $taskSecrets -Raw | ConvertFrom-Json
} else {
    $taskCredentials = [PSCustomObject]@{ owner = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N'); app = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
    $taskCredentials | ConvertTo-Json | Set-Content -LiteralPath $taskSecrets -Encoding ascii
}
if (-not (Test-Path -LiteralPath (Join-Path $taskData 'PG_VERSION'))) {
    $taskPwFile = Join-Path $taskRoot 'init-password.local.json'
    [System.IO.File]::WriteAllText($taskPwFile, $taskCredentials.owner)
    try {
        & (Join-Path $taskBin 'initdb.exe') '-D' $taskData '-U' 'tutoria_owner' '--encoding=UTF8' '--locale=C' '--auth=scram-sha-256' "--pwfile=$taskPwFile"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar PostgreSQL.' }
    } finally { Remove-Item -LiteralPath $taskPwFile -ErrorAction SilentlyContinue }
    Add-Content -LiteralPath (Join-Path $taskData 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = $Port`nmax_connections = 40`n"
}
& (Join-Path $taskBin 'pg_ctl.exe') status '-D' $taskData *> $null
if ($LASTEXITCODE -ne 0) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "El puerto $Port ya está ocupado." }
    $taskPgProcess = Start-Process -FilePath (Join-Path $taskBin 'pg_ctl.exe') -ArgumentList @('start','-D',('"'+$taskData+'"'),'-l',('"'+(Join-Path $taskRoot 'postgresql.log')+'"'),'-w') -WindowStyle Hidden -PassThru
    if (-not $taskPgProcess.WaitForExit(30000)) { throw 'PostgreSQL tardó demasiado en iniciar. Revisa su log local.' }
    if ($taskPgProcess.ExitCode -ne 0) { throw 'PostgreSQL no pudo iniciar. Revisa su log local.' }
}
$taskPreviousPassword = $env:PGPASSWORD
try {
    $env:PGPASSWORD = $taskCredentials.owner
    $taskPsql = Join-Path $taskBin 'psql.exe'
    $taskRoleSql = "SELECT 1 FROM pg_roles WHERE rolname='tutoria_app'"
    $taskRoleExists = & $taskPsql -h 127.0.0.1 -p $Port -U tutoria_owner -d postgres -tAc $taskRoleSql
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo conectar al PostgreSQL local.' }
    if (-not $taskRoleExists) {
        "CREATE ROLE tutoria_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$($taskCredentials.app)';" | & $taskPsql -h 127.0.0.1 -p $Port -U tutoria_owner -d postgres -v ON_ERROR_STOP=1
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el rol de la aplicación.' }
    }
    foreach ($taskDb in @('tutoria_unas','tutoria_unas_tests')) {
        $taskDbExists = & $taskPsql -h 127.0.0.1 -p $Port -U tutoria_owner -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$taskDb'"
        if (-not $taskDbExists) {
            & (Join-Path $taskBin 'createdb.exe') -h 127.0.0.1 -p $Port -U tutoria_owner -O tutoria_app $taskDb
            if ($LASTEXITCODE -ne 0) { throw "No se pudo crear $taskDb." }
        }
    }
} finally { $env:PGPASSWORD = $taskPreviousPassword }
$taskConnection = "Host=127.0.0.1;Port=$Port;Database=tutoria_unas;Username=tutoria_app;Password=$($taskCredentials.app);Include Error Detail=false"
$taskConfig = @{ Database=@{Enabled=$true}; ConnectionStrings=@{Tutoria=$taskConnection}; Tutoria=@{ApplyMigrations=$true;SeedDemo=$true}; LocalDevelopment=@{Enabled=$true} }
$taskConfig | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskRepo 'backend/TutoriaUNAS.Api/appsettings.Development.local.json') -Encoding utf8
@('VITE_DATA_SOURCE=api','VITE_API_BASE_URL=http://127.0.0.1:5080') | Set-Content -LiteralPath (Join-Path $taskRepo 'frontend/.env.local') -Encoding ascii
Write-Output "PostgreSQL local listo: 127.0.0.1:$Port / tutoria_unas. Credenciales solo en archivos locales ignorados por Git."
