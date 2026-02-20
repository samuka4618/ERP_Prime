#!/usr/bin/env node
/**
 * Inicia o ERP PRIME: opcionalmente inicia o Nginx (proxy na porta 80) e depois o servidor Node.
 * Defina USE_NGINX=false no .env ou ambiente para pular o Nginx e só subir o Node.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const nginxConf = path.join(projectRoot, 'nginx', 'nginx-standalone.conf');
const nodeServer = path.join(projectRoot, 'dist', 'src', 'server.js');
const useNginx = process.env.USE_NGINX !== 'false';

function findNginx() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'nginx.exe' : 'nginx';
  return cmd;
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
  if (useNginx) {
    try {
      await startNginx();
      console.log('✅ Nginx iniciado (proxy na porta 80 → Node na porta 3000)');
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
