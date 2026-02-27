#!/usr/bin/env node
/**
 * Gera certificado SSL autoassinado para https://erp.empresa.local
 * e cria nginx/ssl-cert.conf com os caminhos absolutos.
 * Requer OpenSSL no PATH (vem com Git for Windows, ou instale separadamente).
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const certsDir = path.join(projectRoot, 'certs');
const domain = 'erp.empresa.local';
const crtFile = path.join(certsDir, `${domain}.crt`);
const keyFile = path.join(certsDir, `${domain}.key`);
const sslCertConf = path.join(projectRoot, 'nginx', 'ssl-cert.conf');

// Caminho no formato que o Nginx aceita (barras normais, mesmo no Windows)
function nginxPath(p) {
  return p.replace(/\\/g, '/');
}

if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('✅ Pasta certs/ criada.');
}

function findOpenssl() {
  if (process.platform === 'win32') {
    const gitPaths = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'usr', 'bin', 'openssl.exe')
    ];
    for (const p of gitPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return 'openssl';
}

if (fs.existsSync(crtFile) && fs.existsSync(keyFile)) {
  console.log('ℹ️  Certificado já existe em certs/. Recriando ssl-cert.conf com o caminho atual.');
} else {
  const openssl = findOpenssl();
  const subj = `/CN=${domain}`;
  const result = spawnSync(
    openssl,
    [
      'req', '-x509', '-nodes', '-days', '365',
      '-newkey', 'rsa:2048',
      '-keyout', keyFile,
      '-out', crtFile,
      '-subj', subj
    ],
    { stdio: 'inherit', shell: false, cwd: projectRoot }
  );

  if (result.status !== 0) {
    console.error('❌ Erro ao gerar certificado. Instale o Git for Windows (inclui OpenSSL) ou o OpenSSL e coloque no PATH.');
    process.exit(1);
  }
  console.log('✅ Certificado e chave gerados em certs/.');
}

const certPath = nginxPath(crtFile);
const keyPath = nginxPath(keyFile);
const content = `# Gerado por scripts/generate-ssl-cert.js - não edite manualmente
ssl_certificate     ${certPath};
ssl_certificate_key ${keyPath};
`;

fs.writeFileSync(sslCertConf, content, 'utf8');
console.log('✅ nginx/ssl-cert.conf criado/atualizado.');

console.log('\nPróximos passos:');
console.log('1. Em cada PC que vai acessar, adicione no arquivo hosts:');
console.log('   <IP_DO_SERVIDOR>    erp.empresa.local');
console.log('2. Reinicie o Nginx (ou use npm start).');
console.log('3. Acesse https://erp.empresa.local e aceite o aviso do navegador uma vez.');
