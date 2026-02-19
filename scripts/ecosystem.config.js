module.exports = {
  apps: [
    {
      name: 'backend-dev',
      script: 'pm2-backend.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: ['src'],
      ignore_watch: ['node_modules', 'logs', 'dist'],
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: './logs/pm2-backend-error.log',
      out_file: './logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G'
    },
    {
      name: 'frontend-dev',
      script: 'pm2-frontend.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      watch: ['frontend/src'],
      ignore_watch: ['node_modules', 'dist'],
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      error_file: './logs/pm2-frontend-error.log',
      out_file: './logs/pm2-frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M'
    }
  ]
};

