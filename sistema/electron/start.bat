@echo off
echo ========================================
echo Sistema de Chamados - Electron
echo ========================================
echo.

REM Verificar se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js de https://nodejs.org
    pause
    exit /b 1
)

REM Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo Instalando dependencias...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
)

REM Verificar se o frontend foi buildado
if not exist "..\frontend\dist\index.html" (
    echo AVISO: Frontend nao foi buildado ainda.
    echo.
    echo Deseja fazer o build agora? (S/N)
    set /p BUILD_FRONTEND=
    if /i "%BUILD_FRONTEND%"=="S" (
        echo Fazendo build do frontend...
        cd ..\frontend
        call npm run build
        if %ERRORLEVEL% NEQ 0 (
            echo ERRO: Falha ao fazer build do frontend!
            pause
            exit /b 1
        )
        cd ..\electron
    ) else (
        echo Rodando em modo desenvolvimento (requer servidor Vite rodando)...
        set DEV_MODE=--dev
    )
)

REM Iniciar o Electron
echo.
echo Iniciando aplicativo Electron...
echo.
if defined DEV_MODE (
    call npm run dev
) else (
    call npm start
)

pause

