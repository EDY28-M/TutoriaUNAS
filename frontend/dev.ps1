$ErrorActionPreference = 'Stop'
$nodeDir = "C:\Users\UNAS\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin"
$nodeExe = Join-Path $nodeDir "node.exe"
$pnpmMjs = "C:\Users\UNAS\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"

if (-not (Test-Path $nodeExe)) {
    # Fallback to cache directory if needed
    $nodeDir = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
    $nodeExe = Join-Path $nodeDir "node.exe"
    $pnpmMjs = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
}

$env:PATH = $nodeDir + [IO.Path]::PathSeparator + $env:PATH

if ($pnpmMjs.EndsWith('.mjs')) {
    & $nodeExe $pnpmMjs dev @args
} else {
    & $pnpmMjs dev @args
}
