const path = require('path');

/**
 * PM2 — mesmo processo que `npm start` (node dist/src/server.js).
 * No Windows, lançar `npm` via PM2 costuma falhar com spawn EINVAL; por isso usamos o ficheiro compilado directamente.
 */
module.exports = {
  apps: [
    {
      name: 'erp-prime',
      cwd: __dirname,
      script: path.join(__dirname, 'dist', 'src', 'server.js'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-erp-prime-error.log',
      out_file: './logs/pm2-erp-prime-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
