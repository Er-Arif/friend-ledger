[CmdletBinding()]
param(
    [switch]$Bundle = $false
)

$ErrorActionPreference = "Stop"

$EXPECTED_SIGNER_SHA256 = "f8d2253c6cf772063cc26336fa055bb79e814198aa6660be3a76cc16a202e0dd"
$PRODUCTION_API_URL = "https://backend-production-a749.up.railway.app"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Friend Ledger - Android Release Build  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Determine Repository & Mobile Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$MobileDir = Join-Path $RootDir "mobile"
$AndroidDir = Join-Path $MobileDir "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Error "Android native directory not found at '$AndroidDir'. Run 'npx expo prebuild --platform android' inside mobile directory first."
    exit 1
}

# 2. Validate JAVA_HOME - Require JDK 17
function Get-JavaMajorVersion([string]$javaExe) {
    if (-not (Test-Path $javaExe)) { return $null }
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $javaExe
        $psi.Arguments = "-version"
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        $stderr = $p.StandardError.ReadToEnd()
        $p.WaitForExit()
        if ($stderr -match 'version "(17\.[0-9._]+|17)"' -or $stderr -match 'build 17\.') {
            return 17
        } elseif ($stderr -match 'version "([0-9]+)') {
            return [int]$Matches[1]
        }
    } catch {
        return $null
    }
    return $null
}

$CurrentJavaVer = $null
if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
    $CurrentJavaVer = Get-JavaMajorVersion (Join-Path $env:JAVA_HOME "bin\java.exe")
}

if ($CurrentJavaVer -eq 17) {
    Write-Host "Using configured JAVA_HOME (JDK 17): $env:JAVA_HOME" -ForegroundColor Green
} else {
    $KnownJdk17Candidates = @(
        "C:\Program Files\ojdkbuild\java-17-openjdk-17.0.3.0.6-1",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Java\jdk-17*"
    )
    $FoundJdk17 = $null
    foreach ($cand in $KnownJdk17Candidates) {
        $resolved = Get-Item $cand -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path (Join-Path $resolved.FullName "bin\java.exe"))) {
            if ((Get-JavaMajorVersion (Join-Path $resolved.FullName "bin\java.exe")) -eq 17) {
                $FoundJdk17 = $resolved.FullName
                break
            }
        }
    }

    if (-not $FoundJdk17) {
        $GradleJdk17 = Get-ChildItem -Path (Join-Path $env:USERPROFILE ".gradle\jdks") -Filter "java.exe" -Recurse -ErrorAction SilentlyContinue |
            Where-Object { (Get-JavaMajorVersion $_.FullName) -eq 17 } | Select-Object -First 1
        if ($GradleJdk17) {
            $FoundJdk17 = $GradleJdk17.Directory.Parent.FullName
        }
    }

    if ($FoundJdk17) {
        $env:JAVA_HOME = $FoundJdk17
        Write-Host "Selected JDK 17 at: $env:JAVA_HOME" -ForegroundColor Green
    } else {
        Write-Error "JDK 17 is required for Friend Ledger Android release builds. Configured JAVA_HOME is version $CurrentJavaVer. Please install JDK 17 and configure JAVA_HOME."
        exit 1
    }
}

# Ensure Java bin is in PATH
$JavaBin = Join-Path $env:JAVA_HOME "bin"
if ($env:Path -notlike "*$JavaBin*") {
    $env:Path = "$JavaBin;$env:Path"
}

# 3. Validate ANDROID_HOME
$DefaultSdk = Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk"
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
    if (Test-Path $DefaultSdk) {
        $env:ANDROID_HOME = $DefaultSdk
        Write-Host "Using Android SDK at: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Error "ANDROID_HOME is not set and default SDK was not found at $DefaultSdk"
        exit 1
    }
} else {
    Write-Host "ANDROID_HOME is: $env:ANDROID_HOME" -ForegroundColor Green
}

# 4. Set Production Environment Variables
$env:EXPO_PUBLIC_API_BASE_URL = $PRODUCTION_API_URL
$env:NODE_ENV = "production"
Write-Host "Configured EXPO_PUBLIC_API_BASE_URL: $PRODUCTION_API_URL" -ForegroundColor Green

# 5. Validate Release Signing Configuration before Gradle starts
$KeystorePropsPath = Join-Path $AndroidDir "keystore.properties"
if (-not (Test-Path $KeystorePropsPath)) {
    $KeystorePropsPath = Join-Path $MobileDir "keystore.properties"
}

$HasEnvSigning = ($env:RELEASE_STORE_FILE -or $env:ANDROID_KEYSTORE_FILE) -and
                 ($env:RELEASE_STORE_PASSWORD -or $env:ANDROID_KEYSTORE_PASSWORD) -and
                 ($env:RELEASE_KEY_ALIAS -or $env:ANDROID_KEY_ALIAS) -and
                 ($env:RELEASE_KEY_PASSWORD -or $env:ANDROID_KEY_PASSWORD)

$HasFileSigning = $false
$ResolvedStoreFile = $null

if (Test-Path $KeystorePropsPath) {
    $propContent = Get-Content $KeystorePropsPath -Raw
    $hasStoreFile = $propContent -match 'storeFile\s*=\s*(.+)'
    $sf = if ($hasStoreFile) { $Matches[1].Trim() } else { $null }
    $hasStorePass = $propContent -match 'storePassword\s*=\s*.+'
    $hasAlias = $propContent -match 'keyAlias\s*=\s*.+'
    $hasKeyPass = $propContent -match 'keyPassword\s*=\s*.+'

    if ($sf -and $hasStorePass -and $hasAlias -and $hasKeyPass) {
        if (Test-Path (Join-Path $AndroidDir $sf)) {
            $ResolvedStoreFile = Join-Path $AndroidDir $sf
            $HasFileSigning = $true
        } elseif (Test-Path (Join-Path $MobileDir $sf)) {
            $ResolvedStoreFile = Join-Path $MobileDir $sf
            $HasFileSigning = $true
        } elseif (Test-Path $sf) {
            $ResolvedStoreFile = $sf
            $HasFileSigning = $true
        }
    }
}

if (-not $HasFileSigning -and -not $HasEnvSigning) {
    Write-Error "Release signing credentials are missing! A release build requires valid signing credentials.`nEnsure keystore.properties (with storeFile, storePassword, keyAlias, keyPassword) or RELEASE_STORE_* environment variables are configured."
    exit 1
}

Write-Host "Release signing configuration verified." -ForegroundColor Green

# 6. Execute Gradle Build
Push-Location $AndroidDir
try {
    $Gradlew = Join-Path $AndroidDir "gradlew.bat"
    if ($Bundle) {
        Write-Host "Building Android App Bundle (AAB)..." -ForegroundColor Cyan
        & $Gradlew bundleRelease
        if ($LASTEXITCODE -ne 0) { throw "Gradle bundleRelease failed with exit code $LASTEXITCODE" }
        $AabPath = Join-Path $AndroidDir "app\build\outputs\bundle\release\app-release.aab"
        if (-not (Test-Path $AabPath)) { throw "Expected AAB was not found at $AabPath" }
        Write-Host "BUILD SUCCESSFUL" -ForegroundColor Green
        Write-Host "AAB Output: $AabPath" -ForegroundColor Green
    } else {
        Write-Host "Building standalone Android Release APK..." -ForegroundColor Cyan
        & $Gradlew assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "Gradle assembleRelease failed with exit code $LASTEXITCODE" }
        $ApkPath = Join-Path $AndroidDir "app\build\outputs\apk\release\app-release.apk"
        if (-not (Test-Path $ApkPath)) { throw "Expected APK was not found at $ApkPath" }
        Write-Host "BUILD SUCCESSFUL" -ForegroundColor Green
        Write-Host "APK Output: $ApkPath" -ForegroundColor Green

        # 7. Signature Verification
        $Apksigner = Get-ChildItem -Path (Join-Path $env:ANDROID_HOME "build-tools") -Filter "apksigner.bat" -Recurse -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending | Select-Object -First 1

        if (-not $Apksigner) {
            throw "apksigner.bat not found in ANDROID_HOME ($env:ANDROID_HOME\build-tools)"
        }

        Write-Host "Verifying APK signature with apksigner ($($Apksigner.FullName))..." -ForegroundColor Cyan
        $psiSigner = New-Object System.Diagnostics.ProcessStartInfo
        $psiSigner.FileName = $Apksigner.FullName
        $psiSigner.Arguments = "verify --print-certs `"$ApkPath`""
        $psiSigner.RedirectStandardOutput = $true
        $psiSigner.RedirectStandardError = $true
        $psiSigner.UseShellExecute = $false
        $pSigner = [System.Diagnostics.Process]::Start($psiSigner)
        $certOutput = $pSigner.StandardOutput.ReadToEnd()
        $signerErr = $pSigner.StandardError.ReadToEnd()
        $pSigner.WaitForExit()

        if ($pSigner.ExitCode -ne 0) {
            throw "apksigner failed with exit code $($pSigner.ExitCode):`n$signerErr`n$certOutput"
        }

        $combinedOutput = "$certOutput`n$signerErr"
        $sha256Match = $combinedOutput -match 'certificate SHA-256 digest:\s*([0-9a-fA-F]{64})'
        if (-not $sha256Match) {
            throw "Could not extract signer SHA-256 digest from apksigner output:`n$combinedOutput"
        }

        $ActualSha256 = $Matches[1].ToLower().Trim()
        Write-Host "Signer certificate SHA-256: $ActualSha256" -ForegroundColor Green

        if ($ActualSha256 -ne $EXPECTED_SIGNER_SHA256) {
            throw "CRITICAL SIGNING MISMATCH!`nExpected: $EXPECTED_SIGNER_SHA256`nActual:   $ActualSha256`nAborting release."
        }
        Write-Host "Verified: Signer certificate matches permanent release key." -ForegroundColor Green
    }
} finally {
    Pop-Location
}
