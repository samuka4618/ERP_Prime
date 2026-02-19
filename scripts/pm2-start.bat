@echo off
echo Iniciando sistema com PM2...
npx pm2 start ecosystem.config.js
npx pm2 status

