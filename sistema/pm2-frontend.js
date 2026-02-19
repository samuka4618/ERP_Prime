const { spawn } = require('child_process');
const path = require('path');

// Executar o comando npm run dev no frontend
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const frontendProcess = spawn(npm, ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  stdio: 'inherit',
  shell: true
});

frontendProcess.on('error', (error) => {
  console.error('Erro ao iniciar frontend:', error);
  process.exit(1);
});

frontendProcess.on('exit', (code) => {
  process.exit(code || 0);
});

