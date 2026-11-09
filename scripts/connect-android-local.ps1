param([string]$Device = 'emulator-5554')
$ErrorActionPreference = 'Stop'

# Encaminha apenas a porta local; não altera bind, autenticação ou dados.
$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
$adbPath = if ($sdkPath) { Join-Path $sdkPath 'platform-tools/adb.exe' } else { $null }
if (-not $adbPath -or -not (Test-Path -LiteralPath $adbPath)) {
    $adbCommand = Get-Command adb -ErrorAction SilentlyContinue
    if (-not $adbCommand) { throw 'ADB não encontrado. Configure ANDROID_HOME ou ANDROID_SDK_ROOT.' }
    $adbPath = $adbCommand.Source
}

try { $health = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 5 }
catch { throw 'API local inacessível. Inicie MongoDB (npm.cmd run db:local) e API (npm.cmd start) em terminais separados.' }
if ($health.status -ne 'ok' -or $health.database -ne 'mongodb') {
    throw 'Health da API/MongoDB não confirmou funcionamento.'
}
if ($health.authentication -ne 'DEMONSTRACAO_LOCAL') {
    throw 'Autenticação demonstrativa não está habilitada. Confira o ambiente local conforme README.'
}

$deviceState = & $adbPath -s $Device get-state 2>$null
if ($LASTEXITCODE -ne 0 -or "$deviceState".Trim() -ne 'device') {
    throw 'Emulador indisponível ou não autorizado. Confira adb devices e o parâmetro -Device.'
}
& $adbPath -s $Device reverse tcp:3000 tcp:3000
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível configurar o encaminhamento ADB local.' }
$mappings = & $adbPath -s $Device reverse --list
if ($LASTEXITCODE -ne 0 -or -not ($mappings -match '\btcp:3000\s+tcp:3000\b')) {
    throw 'Encaminhamento local não confirmado.'
}
Write-Output 'API/MongoDB saudáveis; Android encaminhado para http://127.0.0.1:3000.'
Write-Output 'Use uma sessão demonstrativa válida. Repita após reiniciar/reconectar o emulador ou ADB.'
