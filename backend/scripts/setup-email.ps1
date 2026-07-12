# AssetFlow — Gmail SMTP Setup Script
# Run AFTER creating your Gmail App Password

Write-Host ""
Write-Host "=== AssetFlow Email Setup ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before running this, create a Gmail App Password:"
Write-Host "  1. Go to https://myaccount.google.com/apppasswords"
Write-Host "  2. Enable 2-Step Verification if prompted"
Write-Host "  3. Create password for 'Mail' -> name it 'AssetFlow'"
Write-Host "  4. Copy the 16-character password (remove spaces)"
Write-Host ""

$email = Read-Host "Enter your Gmail address (e.g. you@gmail.com)"
$appPass = Read-Host "Enter your 16-character App Password" -AsSecureString
$plainPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appPass)
)
$plainPass = $plainPass -replace '\s', ''

if (-not $email -or -not $plainPass) {
  Write-Host "Email and password are required." -ForegroundColor Red
  exit 1
}

$envPath = Join-Path $PSScriptRoot ".." ".env" | Resolve-Path
$content = Get-Content $envPath -Raw

$content = $content -replace 'SMTP_USER=.*', "SMTP_USER=$email"
$content = $content -replace 'SMTP_PASS=.*', "SMTP_PASS=$plainPass"
$content = $content -replace 'SMTP_FROM=.*', "SMTP_FROM=AssetFlow <$email>"

Set-Content -Path $envPath -Value $content -NoNewline

Write-Host ""
Write-Host "Updated backend/.env with your SMTP credentials." -ForegroundColor Green
Write-Host "Restarting backend to apply changes..." -ForegroundColor Yellow
Write-Host ""

# Kill existing backend on port 5000
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

$backendDir = Join-Path $PSScriptRoot ".."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; npm run dev" -WindowStyle Normal

Write-Host "Backend restarted in a new window." -ForegroundColor Green
Write-Host "Look for: Email: SMTP ready (smtp.gmail.com:587)" -ForegroundColor Green
Write-Host ""
Write-Host "Then test: Sign in as admin -> Security -> Send Test Email" -ForegroundColor Cyan
