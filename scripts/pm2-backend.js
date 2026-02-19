const { spawn } = require('child_process');
const path = require('path');

// Executar o comando npm run dev:backend
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const backendProcess = spawn(npm, ['run', 'dev:backend'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

backendProcess.on('error', (error) => {
  console.error('Erro ao iniciar backend:', error);
  process.exit(1);
});

backendProcess.on('exit', (code) => {
  process.exit(code || 0);
});

