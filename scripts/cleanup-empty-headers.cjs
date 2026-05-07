const fs = require('fs');
const path = require('path');
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory() && ent.name !== 'node_modules') walk(p);
    else if (ent.isFile() && /\.(tsx|ts)$/.test(ent.name) && p.includes(`web-next${path.sep}src${path.sep}legacy`)) {
      let s = fs.readFileSync(p, 'utf8');
      const o = s;
      s = s.replace(/,\s*headers:\s*\{\s*\}/g, '');
      s = s.replace(/headers:\s*\{\s*\}\s*,?/g, '');
      if (s !== o) fs.writeFileSync(p, s);
    }
  }
}
walk(path.join(__dirname, '..', 'web-next', 'src', 'legacy'));
