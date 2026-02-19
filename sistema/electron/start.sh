#!/bin/bash

echo "========================================"
echo "Sistema de Chamados - Electron"
echo "========================================"
echo ""

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "ERRO: Node.js não encontrado!"
    echo "Por favor, instale o Node.js de https://nodejs.org"
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
    if [ $? -ne 0 ]; then
        echo "ERRO: Falha ao instalar dependências!"
        exit 1
    fi
fi

# Verificar se o frontend foi buildado
if [ ! -f "../frontend/dist/index.html" ]; then
    echo "AVISO: Frontend não foi buildado ainda."
    echo ""
    read -p "Deseja fazer o build agora? (s/N): " BUILD_FRONTEND
    if [ "$BUILD_FRONTEND" = "s" ] || [ "$BUILD_FRONTEND" = "S" ]; then
        echo "Fazendo build do frontend..."
        cd ../frontend
        npm run build
        if [ $? -ne 0 ]; then
            echo "ERRO: Falha ao fazer build do frontend!"
            exit 1
        fi
        cd ../electron
    else
        echo "Rodando em modo desenvolvimento (requer servidor Vite rodando)..."
        DEV_MODE="--dev"
    fi
fi

# Iniciar o Electron
echo ""
echo "Iniciando aplicativo Electron..."
echo ""
if [ -n "$DEV_MODE" ]; then
    npm run dev
else
    npm start
fi

