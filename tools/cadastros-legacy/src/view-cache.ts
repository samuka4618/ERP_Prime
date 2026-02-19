import { CNPJCache } from './utils/cnpjCache';

console.log('📋 Visualizador de Cache - SPC CNPJ Bot\n');

// Inicializa o cache
CNPJCache.initialize();

// Limpa cache expirado
const removedCount = CNPJCache.cleanExpiredCache();
if (removedCount > 0) {
  console.log(`🧹 ${removedCount} CNPJs expirados foram removidos do cache\n`);
}

// Obtém estatísticas
const stats = CNPJCache.getCacheStats();
console.log('📊 Estatísticas do Cache:');
console.log(`   Total de CNPJs: ${stats.total}`);
console.log(`   Válidos: ${stats.valid}`);
console.log(`   Expirados: ${stats.expired}`);
console.log(`   Sucessos: ${stats.successful}`);
console.log(`   Falhas: ${stats.failed}`);
console.log('');

// Lista CNPJs em cache
const cachedCNPJs = CNPJCache.listCachedCNPJs();

if (cachedCNPJs.length === 0) {
  console.log('📝 Nenhum CNPJ em cache.');
} else {
  console.log('📝 CNPJs em Cache (válidos):');
  console.log('─'.repeat(100));
  console.log('CNPJ'.padEnd(18) + 'Status'.padEnd(10) + 'Consultado em'.padEnd(20) + 'Expira em'.padEnd(20) + 'Arquivo');
  console.log('─'.repeat(100));
  
  cachedCNPJs.forEach(cached => {
    const cnpj = cached.cnpj;
    const status = cached.success ? '✅ Sucesso' : '❌ Falha';
    const consultedAt = new Date(cached.consultedAt).toLocaleString('pt-BR');
    const expiresAt = new Date(cached.expiresAt).toLocaleString('pt-BR');
    const fileName = cached.fileName || 'N/A';
    
    console.log(
      cnpj.padEnd(18) + 
      status.padEnd(10) + 
      consultedAt.padEnd(20) + 
      expiresAt.padEnd(20) + 
      fileName
    );
  });
  
  console.log('─'.repeat(100));
}

console.log('\n💡 Comandos úteis:');
console.log('   - Os CNPJs em cache não serão consultados novamente');
console.log('   - O cache expira automaticamente conforme configurado');
console.log('   - Execute este comando para ver o status atual do cache');
console.log('   - CNPJs com falha podem ser consultados novamente após expirarem');
