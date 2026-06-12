# DPAPI-protected local secret store for OPENROUTER_API_KEY.
# Encrypted with the current Windows user's key (CurrentUser scope) - no
# plaintext on disk, decryptable only by this user on this machine.
#
#   npm run secret:set     prompt (hidden input) and store
#   npm run secret:clear   remove the stored secret
#   scripts/extract.mjs    reads it automatically when env/.env have no key
param(
    [switch]$Set,
    [switch]$Get,
    [switch]$Clear,
    [string]$Value
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$dir = Join-Path $env:APPDATA "worldview"
$file = Join-Path $dir "openrouter_api_key.dat"

if ($Set) {
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    if ($Value) {
        Write-Warning "Passing -Value puts the key in shell history; prefer the interactive prompt."
        $plain = $Value
    } else {
        $secure = Read-Host -Prompt "Paste OPENROUTER_API_KEY (input hidden)" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    if (-not $plain) { Write-Error "Empty value - nothing stored."; exit 1 }
    $bytes = [Text.Encoding]::UTF8.GetBytes($plain)
    $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, "CurrentUser")
    [IO.File]::WriteAllBytes($file, $protected)
    Write-Output "Stored (DPAPI, CurrentUser scope) at: $file"
    exit 0
}

if ($Get) {
    if (-not (Test-Path $file)) { exit 1 }
    $protected = [IO.File]::ReadAllBytes($file)
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, "CurrentUser")
    [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))
    exit 0
}

if ($Clear) {
    if (Test-Path $file) { Remove-Item $file -Force; Write-Output "Cleared." }
    else { Write-Output "Nothing stored." }
    exit 0
}

Write-Error "Use exactly one of: -Set, -Get, -Clear"
exit 1
