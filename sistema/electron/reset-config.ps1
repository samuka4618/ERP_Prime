# Script para resetar a configuração do Electron
# Este script deleta o arquivo de configuração para permitir reconfiguração

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Reset de Configuração - Sistema de Chamados" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Caminho do arquivo de configuração
$configPath = "$env:APPDATA\sistema-chamados-electron\config.json"

if (Test-Path $configPath) {
    Write-Host "Arquivo de configuração encontrado: $configPath" -ForegroundColor Yellow
    Write-Host ""
    
    # Mostrar conteúdo atual
    Write-Host "Configuração atual:" -ForegroundColor Gray
    Get-Content $configPath | Write-Host -ForegroundColor Gray
    Write-Host ""
    
    # Confirmar exclusão
    $confirm = Read-Host "Deseja realmente deletar a configuração? (S/N)"
    
    if ($confirm -eq "S" -or $confirm -eq "s") {
        Remove-Item -Path $configPath -Force
        Write-Host ""
        Write-Host "✓ Configuração deletada com sucesso!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Na próxima execução do aplicativo, a janela de configuração será exibida novamente." -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Operação cancelada." -ForegroundColor Yellow
    }
} else {
    Write-Host "Arquivo de configuração não encontrado." -ForegroundColor Yellow
    Write-Host "Caminho esperado: $configPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "O aplicativo ainda não foi configurado ou já foi resetado." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

