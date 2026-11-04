[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
$taskBackend = Join-Path $taskRepo 'backend'
$taskOutput = Join-Path $taskRepo 'artifacts/backend-tests/cobertura-verificada'
$taskRun = Join-Path $taskOutput ([guid]::NewGuid().ToString())
$taskTemp = Join-Path $taskOutput 'temp'
New-Item -ItemType Directory -Path $taskTemp -Force | Out-Null
$taskOldTemp = $env:TEMP
$taskOldTmp = $env:TMP

try {
    # Coverlet debe poder escribir su bloqueo y sus hits. Solo afecta a este proceso
    # y sus hijos; no modifica permisos ni variables persistentes de Windows.
    $env:TEMP = (Resolve-Path -LiteralPath $taskTemp).Path
    $env:TMP = $env:TEMP
    Push-Location -LiteralPath $taskBackend
    try {
        & dotnet test TutoriaUNAS.slnx --configuration Release --no-restore --collect:'XPlat Code Coverage' --settings coverage.runsettings --results-directory $taskRun --logger 'trx;LogFileName=pruebas.trx'
        if ($LASTEXITCODE -ne 0) { throw "dotnet test fallo con codigo $LASTEXITCODE" }
    } finally {
        Pop-Location
    }

    $taskReport = Get-ChildItem -LiteralPath $taskRun -Recurse -Filter coverage.cobertura.xml |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $taskReport) { throw 'No se genero un reporte Cobertura.' }
    [xml]$taskCoverage = Get-Content -LiteralPath $taskReport.FullName -Raw
    if ([int]$taskCoverage.coverage.'lines-covered' -eq 0) {
        throw 'Coverlet no registro hits. El porcentaje cero no es una medicion valida de esta bateria.'
    }
    $taskLines = @{}
    foreach ($taskClass in $taskCoverage.coverage.packages.package.classes.class) {
        if ($taskClass.filename -match '^obj[/\\]') { continue }
        foreach ($taskLine in $taskClass.lines.line) {
            $taskKey = $taskClass.filename + ':' + $taskLine.number
            $taskLines[$taskKey] = [Math]::Max([int]$taskLines[$taskKey], [int]$taskLine.hits)
        }
    }
    $taskCovered = @($taskLines.Values | Where-Object { $_ -gt 0 }).Count
    $taskSummary = [ordered]@{
        sourceLines = $taskLines.Count
        sourceLinesCovered = $taskCovered
        sourceLinePercent = [Math]::Round(100 * $taskCovered / $taskLines.Count, 2)
        sourceScope = 'Ubicaciones unicas de linea, excluyendo obj/'
        rawLinePercent = [Math]::Round(100 * [double]$taskCoverage.coverage.'line-rate', 2)
        rawBranchPercent = [Math]::Round(100 * [double]$taskCoverage.coverage.'branch-rate', 2)
        report = $taskReport.FullName
    }
    $taskSummary | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskOutput 'resumen.json') -Encoding utf8
    $taskSummary | ConvertTo-Json
} finally {
    $env:TEMP = $taskOldTemp
    $env:TMP = $taskOldTmp
}
