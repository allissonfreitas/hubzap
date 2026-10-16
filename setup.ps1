$ErrorActionPreference = "Stop"
Write-Host "=== HubZap by AFATEC ===" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js nao encontrado. Instale o Node.js LTS e execute este arquivo novamente." -ForegroundColor Yellow
  exit 1
}

Write-Host "Node: $(node --version)"
Write-Host "NPM:  $(npm --version)"
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Instalacao concluida." -ForegroundColor Green
Write-Host "Execute: npm start" -ForegroundColor Cyan
