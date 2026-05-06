const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ALLOWED_PATH_PARTS = [
  `${path.sep}scripts${path.sep}`,
  `${path.sep}docs${path.sep}`,
  `${path.sep}tools${path.sep}`
];
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const VIOLATIONS = [];

function shouldSkip(filePath) {
  return filePath.includes(`${path.sep}node_modules${path.sep}`) || filePath.includes(`${path.sep}.next${path.sep}`) || filePath.includes(`${path.sep}dist${path.sep}`);
}

function isAllowedFile(filePath) {
  return ALLOWED_PATH_PARTS.some((allowedPart) => filePath.includes(allowedPart));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (isAllowedFile(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes('console.log(') || line.includes('console.error(') || line.includes('console.warn(') || line.includes('console.debug(')) {
        VIOLATIONS.push(`${path.relative(ROOT, fullPath)}:${index + 1}`);
      }
    });
  }
}

walk(ROOT);

if (VIOLATIONS.length) {
  console.error('Encontrados usos de console.* fora das áreas permitidas:');
  VIOLATIONS.slice(0, 100).forEach((v) => console.error(` - ${v}`));
  process.exit(1);
}

console.log('OK: nenhum uso indevido de console.* encontrado.');
