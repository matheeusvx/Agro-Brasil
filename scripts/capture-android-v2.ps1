param([string]$Device = 'emulator-5556')
$ErrorActionPreference = 'Stop'
# Roteiro de avaliação da galeria, coordenadas verificadas em 390×844 dp.
# Instalar antes: flutter build apk --debug --dart-define=DEMO_GALLERY=true
$adbPath = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$evidencePath = Join-Path $PSScriptRoot '..\docs\design\android-v2'
New-Item -ItemType Directory -Force -Path $evidencePath | Out-Null
function Invoke-Adb { & $adbPath -s $Device @args; if($LASTEXITCODE -ne 0) { throw 'Falha no adb' } }
function Tap([int]$x, [int]$y) { Invoke-Adb shell input tap $x $y; Start-Sleep -Milliseconds 550 }
function Back { Invoke-Adb shell input keyevent 4; Start-Sleep -Milliseconds 450 }
function Capture([string]$name) {
  Invoke-Adb shell screencap -p /sdcard/agro-v2-evidence.png
  Invoke-Adb pull /sdcard/agro-v2-evidence.png (Join-Path $evidencePath "$name.png")
}
Invoke-Adb shell wm size 780x1688
Invoke-Adb shell wm density 320
Invoke-Adb shell settings put system font_scale 1.0
Invoke-Adb shell am force-stop com.example.agro_mais_brasil
Invoke-Adb shell am start -n com.example.agro_mais_brasil/.MainActivity
Start-Sleep -Seconds 4
Tap 180 373
Capture 'home-clima-390'
Tap 234 1560
Capture 'producao-390'
Tap 390 880
Capture 'rastreabilidade-390'
Back
Tap 390 1560
Capture 'ofertas-390'
Tap 546 1560
Capture 'pedidos-390'
Tap 702 1560
Capture 'perfil-390'
Back
$scenarioRows = [ordered]@{
  'solicitacao'=260; 'primeiro-acesso'=486; 'retirada'=598;
  'recebimento'=710; 'sem-pendencias'=822; 'offline'=934;
  'erro'=1046; 'carregando'=1158; 'clima-pendencia'=1270
}
foreach($scenario in $scenarioRows.GetEnumerator()) {
  Tap 180 $scenario.Value
  Capture "$($scenario.Key)-390"
  Back
}
Tap 180 373
[ordered]@{
  device=$Device; platform='Android 17 API 37'; logicalViewport='390x844';
  screenshotPixels='780x1688'; density=320; fontScale=1.0;
  mode='DEMO_GALLERY: fixtures explícitas; sem gravações; sem API meteorológica real';
  interactions=@('galeria → clima','home → produção','produção → histórico → voltar',
    'navegação inferior → ofertas → pedidos → perfil', 'oito estados da home');
  capturedAt=(Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $evidencePath 'capture-metadata.json')
