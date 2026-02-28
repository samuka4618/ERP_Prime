#!/usr/bin/env node
'use strict';
// Copia schema.sql e schema.postgres.sql para dist para produção (Railway, Docker, etc.)
const fs = require('fs');
const path = require('path');

const destDir = path.join(__dirname, '..', 'dist', 'src', 'core', 'database');
fs.mkdirSync(destDir, { recursive: true });

const schemaSql = path.join(__dirname, '..', 'src', 'core', 'database', 'schema.sql');
if (fs.existsSync(schemaSql)) {
  fs.copyFileSync(schemaSql, path.join(destDir, 'schema.sql'));
  console.log('copy-schema: schema.sql copiado para', destDir);
}

const schemaPg = path.join(__dirname, '..', 'src', 'core', 'database', 'schema.postgres.sql');
if (fs.existsSync(schemaPg)) {
  fs.copyFileSync(schemaPg, path.join(destDir, 'schema.postgres.sql'));
  console.log('copy-schema: schema.postgres.sql copiado para', destDir);
}
const schemaFullPg = path.join(__dirname, '..', 'src', 'core', 'database', 'schema-full.postgres.sql');
if (fs.existsSync(schemaFullPg)) {
  fs.copyFileSync(schemaFullPg, path.join(destDir, 'schema-full.postgres.sql'));
  console.log('copy-schema: schema-full.postgres.sql copiado para', destDir);
}
