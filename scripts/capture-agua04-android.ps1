param([string]$Device = 'emulator-5554')
$ErrorActionPreference = 'Stop'
$adbPath = Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
$rootPath = Split-Path $PSScriptRoot -Parent
$evidencePath = Join-Path $rootPath 'docs/design/territorial/evidencias'
New-Item -ItemType Directory -Force -Path $evidencePath | Out-Null

# Requires the reviewed APK built with DEMO_GALLERY=true, no production API.
# Home/cache fixture is explicit; WaterDashboard always reads audited real assets.
function Invoke-Adb { & $adbPath -s $Device @args; if ($LASTEXITCODE -ne 0) { throw 'adb failed' } }
function Tap([int]$x, [int]$y) {
    Invoke-Adb shell input tap $x $y
    Start-Sleep -Milliseconds 600
}
function Scroll-Up([int]$distance = 700) {
    Invoke-Adb shell input swipe 750 1450 750 (1450 - $distance) 1600
    # Stop emulator debug-build fling without activating a chart or control.
    Invoke-Adb shell input tap 775 800
    Start-Sleep -Milliseconds 700
}
function Capture([string]$name) {
    Invoke-Adb shell screencap -p /sdcard/agua04-final.png
    Invoke-Adb pull /sdcard/agua04-final.png (Join-Path $evidencePath "$name.png")
}

$wifiOriginal = (& $adbPath -s $Device shell settings get global wifi_on).Trim()
$mobileOriginal = (& $adbPath -s $Device shell settings get global mobile_data).Trim()
$fontOriginal = (& $adbPath -s $Device shell settings get system font_scale).Trim()
try {
    Invoke-Adb shell wm size 780x1688
    Invoke-Adb shell wm density 320
    Invoke-Adb shell settings put system font_scale 1.0
    Invoke-Adb shell svc wifi disable
    Invoke-Adb shell svc data disable
    Invoke-Adb shell am force-stop com.example.agro_mais_brasil
    Invoke-Adb shell am start -n com.example.agro_mais_brasil/.MainActivity
    Start-Sleep -Seconds 5
    Tap 180 888 # Gallery: explicit offline home fixture.
    Capture 'android-home-sem-rede'

    $recording = Start-Process -FilePath $adbPath -WindowStyle Hidden -PassThru -ArgumentList @(
        '-s', $Device, 'shell', 'screenrecord', '--bit-rate', '2500000',
        '--time-limit', '50', '/sdcard/agua04-navigation.mp4'
    )
    Start-Sleep -Seconds 1
    Tap 540 104
    Start-Sleep -Seconds 2
    Capture 'android-painel-sem-rede'
    Scroll-Up 800
    Start-Sleep -Seconds 2
    # Entire bar area is a 48dp button; points were inspected in this viewport.
    Tap 556 1050
    Start-Sleep -Seconds 1
    Tap 652 1050
    Scroll-Up 800
    Start-Sleep -Seconds 2
    Scroll-Up 500
    Start-Sleep -Seconds 2
    Scroll-Up 700
    Start-Sleep -Seconds 2
    Scroll-Up 650
    Start-Sleep -Seconds 2
    Invoke-Adb shell input keyevent 4
    Start-Sleep -Seconds 1
    Tap 234 1560 # Existing Produção tab remains available.
    Start-Sleep -Seconds 1
    Tap 78 1560
    # Native screenrecord closes the MP4 cleanly at its own time limit.
    if (-not $recording.WaitForExit(55000)) { throw 'screenrecord did not finish' }
    Invoke-Adb pull /sdcard/agua04-navigation.mp4 (Join-Path $evidencePath 'agua04-navegacao-android.mp4')
    $contract = Get-Content (Join-Path $rootPath 'apps/mobile/assets/agua04/integration-example.json') -Raw | ConvertFrom-Json
    [ordered]@{
        device = $Device
        avd = 'Medium_Phone_API_36.1'
        androidVersion = (& $adbPath -s $Device shell getprop ro.build.version.release).Trim()
        api = (& $adbPath -s $Device shell getprop ro.build.version.sdk).Trim()
        viewportDp = '390x844'
        screenshotPixels = '780x1688'
        density = 320
        fontScale = 1.0
        additionalViewport = '320x844, Android font_scale=2.0; screenshot reviewed'
        home = 'DEMO_GALLERY offline fixture, fictitious and labeled, no writes'
        water = 'Audited real NASA POWER AGUA-04 embedded exports; not fixture'
        networkDuringRecording = 'Wi-Fi and mobile data disabled; restored in finally'
        schemaVersion = $contract.schema_version
        dataAsOf = $contract.data_as_of
        snapshotGeneratedAt = $contract.generated_at_utc
        recordedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
        recordingTimeLimitSeconds = 50
        video = 'Native adb screenrecord; actual media duration in video-validation.json; no mockup or synthetic frames'
    } | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $evidencePath 'android-capture-metadata.json')
}
finally {
    if ($wifiOriginal -eq '1') { & $adbPath -s $Device shell svc wifi enable }
    if ($mobileOriginal -eq '1') { & $adbPath -s $Device shell svc data enable }
    & $adbPath -s $Device shell settings put system font_scale $fontOriginal
}
