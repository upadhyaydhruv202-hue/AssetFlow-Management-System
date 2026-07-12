# AssetFlow — Google Sign-In setup helper
# Run from project root: .\backend\scripts\setup-google-oauth.ps1

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: backend/.env not found" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== AssetFlow Google Sign-In Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "I cannot create the Google Client ID for you (needs your Google login)."
Write-Host "This script will open Google Cloud Console and save your Client ID to .env."
Write-Host ""
Write-Host "Steps in the browser:" -ForegroundColor Yellow
Write-Host "  1. Sign in with your Google account"
Write-Host "  2. Create a project (or pick existing)"
Write-Host "  3. APIs & Services -> OAuth consent screen -> External -> fill app name + your email"
Write-Host "  4. Credentials -> Create Credentials -> OAuth client ID"
Write-Host "  5. Application type: Web application"
Write-Host "  6. Authorized JavaScript origins: http://localhost:5173"
Write-Host "  7. Create -> copy the Client ID"
Write-Host ""

$open = Read-Host "Open Google Cloud Console in browser now? (Y/n)"
if ($open -ne "n" -and $open -ne "N") {
    Start-Process "https://console.cloud.google.com/apis/credentials?project=_"
    Start-Sleep -Seconds 1
    Start-Process "https://console.cloud.google.com/apis/credentials/consent"
}

Write-Host ""
$clientId = Read-Host "Paste your Google Client ID here (ends with .apps.googleusercontent.com)"

if ([string]::IsNullOrWhiteSpace($clientId)) {
    Write-Host "No Client ID entered. Exiting." -ForegroundColor Red
    exit 1
}

$clientId = $clientId.Trim()
if ($clientId -notmatch '\.apps\.googleusercontent\.com$') {
    Write-Host "Warning: Client ID usually ends with .apps.googleusercontent.com" -ForegroundColor Yellow
}

$content = Get-Content $envFile -Raw
if ($content -match '(?m)^GOOGLE_CLIENT_ID=.*$') {
    $content = $content -replace '(?m)^GOOGLE_CLIENT_ID=.*$', "GOOGLE_CLIENT_ID=$clientId"
} else {
    $content = $content.TrimEnd() + "`nGOOGLE_CLIENT_ID=$clientId`n"
}
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host ""
Write-Host "Saved GOOGLE_CLIENT_ID to backend/.env" -ForegroundColor Green
Write-Host "Restart the backend if it is running, then refresh http://localhost:5173/login"
Write-Host ""
