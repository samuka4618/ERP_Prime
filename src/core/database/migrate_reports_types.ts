import { dbRun, dbGet, closeDatabase } from './connection';

async function migrateReportsTypes() {
  console.log('🔄 Iniciando migração: Atualizando tipos de relatórios...\n');

  try {
    // Verificar se a migração já foi executada
    const checkTable = await dbGet(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='reports'
    `) as any;

    if (!checkTable) {
      console.log('⚠️  Tabela reports não encontrada. Execute o schema.sql primeiro.');
      return;
    }

    const currentSql = checkTable.sql || '';
    
    // Verificar se já tem os tipos de compras
    if (currentSql.includes('compras_solicitacoes') && 
        currentSql.includes('compras_orcamentos') && 
        currentSql.includes('compras_aprovacoes') && 
        currentSql.includes('compras_geral')) {
      console.log('✅ Tipos de relatórios de compras já estão atualizados!');
      return;
    }

    console.log('📋 Criando nova tabela reports com tipos atualizados...');

    // 1. Criar nova tabela com constraint atualizada
    await dbRun(`
      CREATE TABLE reports_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL CHECK (type IN ('sla_performance', 'ticket_volume', 'attendant_performance', 'category_analysis', 'tickets_by_attendant', 'general_tickets', 'compras_solicitacoes', 'compras_orcamentos', 'compras_aprovacoes', 'compras_geral', 'custom')),
        parameters TEXT,
        custom_fields TEXT,
        custom_query TEXT,
        created_by INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log('✅ Nova tabela criada');

    // 2. Copiar todos os dados da tabela antiga para a nova
    console.log('📋 Copiando dados...');
    await dbRun(`
      INSERT INTO reports_new 
      SELECT * FROM reports
    `);

    console.log('✅ Dados copiados');

    // 3. Remover tabela antiga
    console.log('🗑️  Removendo tabela antiga...');
    await dbRun(`DROP TABLE reports`);

    // 4. Renomear nova tabela
    console.log('🔄 Renomeando tabela...');
    await dbRun(`ALTER TABLE reports_new RENAME TO reports`);

    // 5. Recriar índices
    console.log('📊 Recriando índices...');
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type)`);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by)`);

    // 6. Recriar trigger
    console.log('⚙️  Recriando trigger...');
    await dbRun(`
      CREATE TRIGGER IF NOT EXISTS update_reports_updated_at 
      AFTER UPDATE ON reports
      BEGIN
        UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `);

    console.log('\n🎉 Migração concluída com sucesso!');
    console.log('✅ Os tipos de relatórios de compras foram adicionados:');
    console.log('   - compras_solicitacoes');
    console.log('   - compras_orcamentos');
    console.log('   - compras_aprovacoes');
    console.log('   - compras_geral');

  } catch (error: any) {
    console.error('❌ Erro durante a migração:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Executar migração se chamado diretamente
if (require.main === module) {
  migrateReportsTypes().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

export { migrateReportsTypes };

