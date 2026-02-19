@echo off
chcp 65001 >nul
echo ========================================
echo Reset de Configuracao - Sistema de Chamados
echo ========================================
echo.

REM Caminho do arquivo de configuração
set "configPath=%APPDATA%\sistema-chamados-electron\config.json"

if exist "%configPath%" (
    echo Arquivo de configuracao encontrado:
    echo %configPath%
    echo.
    
    REM Mostrar conteúdo atual
    echo Configuracao atual:
    type "%configPath%"
    echo.
    
    REM Confirmar exclusão
    set /p confirm="Deseja realmente deletar a configuracao? (S/N): "
    
    REM Remover espaços
    set "confirm=%confirm: =%"
    
    REM Verificar se é S ou s (case-insensitive)
    echo "%confirm%" | findstr /i "^S$" >nul
    if %errorlevel% equ 0 (
        del /F /Q "%configPath%"
        echo.
        echo [OK] Configuracao deletada com sucesso!
        echo.
        echo Na proxima execucao do aplicativo, a janela de configuracao sera exibida novamente.
    ) else (
        echo.
        echo [CANCELADO] Operacao cancelada.
    )
) else (
    echo Arquivo de configuracao nao encontrado.
    echo Caminho esperado: %configPath%
    echo.
    echo O aplicativo ainda nao foi configurado ou ja foi resetado.
)

echo.
pause
