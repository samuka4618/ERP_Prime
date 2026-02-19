# Script para corrigir problemas de build do Electron no Windows
# Executa como Administrador para resolver problemas de symbolic links

Write-Host "Limpando cache do electron-builder..." -ForegroundColor Yellow

# Limpar cache do electron-builder
$cachePath = "$env:LOCALAPPDATA\electron-builder\Cache"
if (Test-Path $cachePath) {
    Remove-Item -Path $cachePath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cache limpo com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Cache não encontrado." -ForegroundColor Gray
}

# Limpar cache do winCodeSign especificamente
$winCodeSignPath = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
if (Test-Path $winCodeSignPath) {
    Remove-Item -Path $winCodeSignPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cache do winCodeSign limpo!" -ForegroundColor Green
}

Write-Host "`nPronto! Agora você pode executar: npm run build:win" -ForegroundColor Green

