#!/usr/bin/env node
'use strict';
// Copia schema.sql para dist para que funcione em produção (Railway, Docker, etc.)
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'core', 'database', 'schema.sql');
const destDir = path.join(__dirname, '..', 'dist', 'src', 'core', 'database');
const dest = path.join(destDir, 'schema.sql');

if (!fs.existsSync(src)) {
  console.warn('copy-schema: src não encontrado:', src);
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log('copy-schema: schema.sql copiado para', dest);
