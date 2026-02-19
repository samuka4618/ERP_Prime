import { Logger } from './utils/logger';

console.log('📋 Visualizador de Logs - SPC CNPJ Bot\n');

// Inicializa o logger
Logger.initialize();

// Obtém estatísticas
const stats = Logger.getStats();
console.log('📊 Estatísticas dos Logs:');
console.log(`   Total de registros: ${stats.total}`);
console.log(`   Sucessos: ${stats.successes}`);
console.log(`   Erros: ${stats.errors}`);
console.log(`   CNPJs inválidos: ${stats.cnpjInvalid}`);
console.log('');

// Lê todos os logs
const logs = Logger.readLogs();

if (logs.length === 0) {
  console.log('📝 Nenhum log encontrado.');
} else {
  console.log('📝 Últimos 20 logs:');
  console.log('─'.repeat(80));
  
  // Mostra os últimos 20 logs
  const recentLogs = logs.slice(-20);
  
  recentLogs.forEach((logLine, index) => {
    try {
      const log = JSON.parse(logLine);
      const timestamp = new Date(log.timestamp).toLocaleString('pt-BR');
      const level = log.level;
      const message = log.message;
      
      // Cores baseadas no nível
      let levelColor = '';
      let resetColor = '';
      
      switch (level) {
        case 'SUCCESS':
          levelColor = '\x1b[32m'; // Verde
          break;
        case 'ERROR':
          levelColor = '\x1b[31m'; // Vermelho
          break;
        case 'CNPJ_INVALID':
          levelColor = '\x1b[33m'; // Amarelo
          break;
        case 'WARN':
          levelColor = '\x1b[33m'; // Amarelo
          break;
        case 'INFO':
          levelColor = '\x1b[36m'; // Ciano
          break;
        default:
          levelColor = '\x1b[37m'; // Branco
      }
      
      console.log(`${levelColor}[${level}]${resetColor} ${timestamp} - ${message}`);
      
      // Mostra dados adicionais se existirem
      if (log.data) {
        console.log(`   Dados: ${JSON.stringify(log.data, null, 2)}`);
      }
      
    } catch (e) {
      console.log(`   Log inválido: ${logLine}`);
    }
  });
  
  console.log('─'.repeat(80));
}

console.log('\n💡 Dicas:');
console.log('   - Os logs são salvos em: ./logs/spc-bot.log');
console.log('   - Execute este comando para ver logs atualizados');
console.log('   - CNPJs inválidos são destacados em amarelo');
console.log('   - Sucessos são destacados em verde');
console.log('   - Erros são destacados em vermelho');
