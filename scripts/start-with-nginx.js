#!/usr/bin/env node
/**
 * Inicia o ERP PRIME: opcionalmente inicia o Ngrok (túnel público), o Nginx (proxy na porta 80) e o servidor Node.
 * .env: USE_NGINX=false para não iniciar Nginx; USE_NGROK=false para não iniciar Ngrok.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const projectRoot = path.resolve(__dirname, '..');
const nginxConf = path.join(projectRoot, 'nginx', 'nginx-standalone.conf');
const nodeServer = path.join(projectRoot, 'dist', 'src', 'server.js');
const port = process.env.PORT || '3000';
const ngrokPort = process.env.NGROK_PORT || port;
const useNginx = process.env.USE_NGINX !== 'false';
const useNgrok = process.env.USE_NGROK !== 'false';

function findNginx() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'nginx.exe' : 'nginx';
  return cmd;
}

/** Verifica se a porta 80 está em uso (ex.: Nginx já rodando). */
function checkPort80InUse() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    socket.connect(80, '127.0.0.1');
  });
}

function startNgrok() {
  const isWin = process.platform === 'win32';
  const ngrokCmd = isWin ? 'ngrok.exe' : 'ngrok';
  const child = spawn(ngrokCmd, ['http', ngrokPort], {
    stdio: 'ignore',
    detached: true,
    cwd: projectRoot,
    shell: process.platform === 'win32'
  });

  child.unref();

  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 1500);
  });
}

function startNginx() {
  if (!fs.existsSync(nginxConf)) {
    console.warn('⚠️  Arquivo nginx não encontrado:', nginxConf);
    return false;
  }

  const nginxCmd = findNginx();
  const child = spawn(nginxCmd, ['-c', nginxConf], {
    stdio: 'ignore',
    detached: true,
    cwd: projectRoot,
    shell: process.platform === 'win32'
  });

  child.unref();

  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 800);
  });
}

function startNode() {
  const child = spawn(process.execPath, [nodeServer], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env
  });

  child.on('error', (err) => {
    console.error('Erro ao iniciar Node:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code != null ? code : 0);
  });
}

async function main() {
  if (useNgrok) {
    try {
      await startNgrok();
      console.log(`✅ Ngrok iniciado (túnel público → localhost:${ngrokPort}). Formulários acessíveis fora da rede.`);
    } catch (e) {
      console.warn('⚠️  Ngrok não iniciado (instale e coloque no PATH: https://ngrok.com/download).');
    }
  }

  if (useNginx) {
    try {
      const port80InUse = await checkPort80InUse();
      if (port80InUse) {
        console.log('ℹ️  Porta 80 já em uso (Nginx ou outro serviço). Pulando início do Nginx.');
      } else {
        await startNginx();
        console.log('✅ Nginx iniciado (proxy na porta 80 → Node na porta 3000)');
      }
    } catch (e) {
      console.warn('⚠️  Nginx não iniciado (pode não estar instalado). Iniciando apenas o Node.');
    }
  }

  if (!fs.existsSync(nodeServer)) {
    console.error('❌ Servidor não compilado. Execute: npm run build');
    process.exit(1);
  }

  startNode();
}

main();
