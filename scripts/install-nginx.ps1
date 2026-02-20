# Instala o Nginx no Windows (via winget ou Chocolatey, se disponíveis).
# Execute no PowerShell: .\scripts\install-nginx.ps1

$installed = $false

if (Get-Command winget -ErrorAction SilentlyContinue) {
  Write-Host "Instalando Nginx via winget..."
  winget install -e --id nginx.nginx --accept-package-agreements --accept-source-agreements 2>$null
  if ($LASTEXITCODE -eq 0) { $installed = $true }
}

if (-not $installed -and (Get-Command choco -ErrorAction SilentlyContinue)) {
  Write-Host "Instalando Nginx via Chocolatey..."
  choco install nginx -y
  $installed = $true
}

if ($installed) {
  Write-Host "`n✅ Nginx instalado. Adicione a pasta do Nginx ao PATH (ex: C:\Program Files\nginx) ou use o caminho completo."
  Write-Host "   Ao dar npm start, o script usará 'nginx' do PATH."
} else {
  Write-Host "`n⚠️  Nginx não foi instalado automaticamente."
  Write-Host "   Opções:"
  Write-Host "   1. Instale o winget e execute: winget install nginx.nginx"
  Write-Host "   2. Ou baixe em: https://nginx.org/en/download.html"
  Write-Host "   3. Coloque nginx.exe no PATH ou na pasta do projeto."
}
