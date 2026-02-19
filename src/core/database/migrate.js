const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Caminho para o banco de dados
const dbPath = path.join(__dirname, '../../../data/database/chamados.db');

console.log('🔄 Iniciando migração do banco de dados...');
console.log('📁 Caminho do banco:', dbPath);

// Verificar se o banco existe
if (!fs.existsSync(dbPath)) {
    console.error('❌ Banco de dados não encontrado em:', dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar com o banco:', err.message);
        process.exit(1);
    }
    console.log('✅ Conectado ao banco de dados SQLite');
});

// Função para executar SQL
function runSQL(sql, description) {
    return new Promise((resolve, reject) => {
        console.log(`🔄 ${description}...`);
        db.run(sql, (err) => {
            if (err) {
                console.error(`❌ Erro em: ${description}`, err.message);
                reject(err);
            } else {
                console.log(`✅ ${description} - Concluído`);
                resolve();
            }
        });
    });
}

// Função para verificar se a migração já foi feita
function checkMigration() {
    return new Promise((resolve, reject) => {
        db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'", (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row && row.sql.includes('pending_approval')) {
                console.log('✅ Migração já foi executada - status pending_approval já existe');
                resolve(true);
            } else {
                console.log('🔄 Migração necessária - status pending_approval não encontrado');
                resolve(false);
            }
        });
    });
}

async function migrate() {
    try {
        // Verificar se já foi migrado
        const alreadyMigrated = await checkMigration();
        if (alreadyMigrated) {
            console.log('🎉 Migração já foi executada anteriormente!');
            db.close();
            return;
        }

        console.log('🚀 Iniciando migração...');

        // 1. Criar nova tabela com constraint atualizada
        await runSQL(`
            CREATE TABLE tickets_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                attendant_id INTEGER,
                category_id INTEGER NOT NULL,
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_user', 'pending_third_party', 'pending_approval', 'resolved', 'closed', 'overdue_first_response', 'overdue_resolution')),
                priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
                sla_first_response DATETIME NOT NULL,
                sla_resolution DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                reopened_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (attendant_id) REFERENCES users(id),
                FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
            )
        `, 'Criando nova tabela com constraint atualizada');

        // 2. Copiar dados
        await runSQL(`
            INSERT INTO tickets_new SELECT * FROM tickets
        `, 'Copiando dados da tabela antiga');

        // 3. Remover tabela antiga
        await runSQL(`
            DROP TABLE tickets
        `, 'Removendo tabela antiga');

        // 4. Renomear nova tabela
        await runSQL(`
            ALTER TABLE tickets_new RENAME TO tickets
        `, 'Renomeando nova tabela');

        // 5. Recriar índices
        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)
        `, 'Recriando índice user_id');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_tickets_attendant_id ON tickets(attendant_id)
        `, 'Recriando índice attendant_id');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)
        `, 'Recriando índice status');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id)
        `, 'Recriando índice category_id');

        await runSQL(`
            CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at)
        `, 'Recriando índice created_at');

        // 6. Recriar trigger
        await runSQL(`
            CREATE TRIGGER IF NOT EXISTS update_tickets_updated_at 
                AFTER UPDATE ON tickets
                BEGIN
                    UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END
        `, 'Recriando trigger updated_at');

        console.log('🎉 Migração concluída com sucesso!');
        console.log('✅ O novo status "pending_approval" foi adicionado ao banco de dados');
        console.log('🚀 Agora você pode usar o fluxo de aprovação do solicitante!');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error.message);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('❌ Erro ao fechar banco:', err.message);
            } else {
                console.log('🔒 Conexão com banco fechada');
            }
        });
    }
}

// Executar migração
migrate();
