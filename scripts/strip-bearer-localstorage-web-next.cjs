const fs = require('fs');
const path = require('path');

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules') walk(p);
    else if (ent.isFile() && /\.(tsx|ts)$/.test(ent.name) && p.includes(`web-next${path.sep}src${path.sep}legacy`)) {
      let s = fs.readFileSync(p, 'utf8');
      const o = s;
      s = s.replace(/,\s*headers:\s*\{\s*'Authorization':\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}/g, '');
      s = s.replace(/,\s*headers:\s*\{\s*Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}/g, '');
      s = s.replace(/headers:\s*\{\s*'Authorization':\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}/g, '');
      s = s.replace(/headers:\s*\{\s*Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\s*\}/g, '');
      s = s.replace(/^[ \t]*'Authorization':\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\,?\r?\n/gm, '');
      s = s.replace(/^[ \t]*Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`\,?\r?\n/gm, '');
      s = s.replace(/^[ \t]*'Authorization':\s*`Bearer \$\{token\}`\,?\r?\n/gm, '');
      s = s.replace(/^[ \t]*Authorization:\s*`Bearer \$\{token\}`\,?\r?\n/gm, '');
      s = s.replace(/^[ \t]*const token = localStorage\.getItem\('token'\);\r?\n/gm, '');
      if (s !== o) {
        fs.writeFileSync(p, s);
        console.log('patched', p);
      }
    }
  }
}

walk(path.join(__dirname, '..', 'web-next', 'src', 'legacy'));
