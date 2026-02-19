// Script para verificar se o frontend foi buildado
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Verificação do Frontend');
console.log('========================================');
console.log('');

const frontendDistPath = path.join(__dirname, '../frontend/dist');
const indexHtmlPath = path.join(frontendDistPath, 'index.html');

console.log('Caminho esperado do frontend:', frontendDistPath);
console.log('Arquivo index.html esperado:', indexHtmlPath);
console.log('');

// Verificar se a pasta dist existe
if (fs.existsSync(frontendDistPath)) {
  console.log('✓ Pasta dist existe');
  
  // Verificar se index.html existe
  if (fs.existsSync(indexHtmlPath)) {
    console.log('✓ Arquivo index.html existe');
    
    // Verificar tamanho do arquivo
    const stats = fs.statSync(indexHtmlPath);
    console.log(`✓ Tamanho do arquivo: ${stats.size} bytes`);
    
    // Ler conteúdo do arquivo
    const content = fs.readFileSync(indexHtmlPath, 'utf8');
    console.log(`✓ Conteúdo do arquivo (primeiros 200 caracteres):`);
    console.log(content.substring(0, 200));
    console.log('');
    
    // Verificar se há referências a assets
    const assetsMatch = content.match(/src=["']([^"']+)["']/g);
    if (assetsMatch) {
      console.log('✓ Arquivo contém referências a assets');
      console.log(`  Encontradas ${assetsMatch.length} referências`);
    }
    
    // Listar arquivos na pasta dist
    console.log('');
    console.log('Arquivos na pasta dist:');
    try {
      const files = fs.readdirSync(frontendDistPath, { recursive: true });
      files.forEach(file => {
        const filePath = path.join(frontendDistPath, file);
        const fileStats = fs.statSync(filePath);
        if (fileStats.isFile()) {
          console.log(`  - ${file} (${fileStats.size} bytes)`);
        } else {
          console.log(`  - ${file}/ (diretório)`);
        }
      });
    } catch (error) {
      console.log('  Erro ao listar arquivos:', error.message);
    }
    
  } else {
    console.log('✗ Arquivo index.html NÃO existe!');
    console.log('');
    console.log('Solução: Execute o build do frontend:');
    console.log('  cd frontend');
    console.log('  npm run build');
  }
  
} else {
  console.log('✗ Pasta dist NÃO existe!');
  console.log('');
  console.log('Solução: Execute o build do frontend:');
  console.log('  cd frontend');
  console.log('  npm run build');
}

console.log('');
console.log('========================================');

