"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const sql = __importStar(require("mssql"));
const logger_1 = require("../utils/logger");
class DatabaseService {
    constructor(config) {
        this.pool = null;
        this.config = config;
    }
    async connect() {
        try {
            const sqlConfig = {
                server: this.config.server,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                port: this.config.port || 1433,
                options: {
                    encrypt: this.config.options?.encrypt || false,
                    trustServerCertificate: this.config.options?.trustServerCertificate || true,
                },
                pool: {
                    max: 10,
                    min: 0,
                    idleTimeoutMillis: 30000
                },
                requestTimeout: 30000,
                connectionTimeout: 30000
            };
            this.pool = new sql.ConnectionPool(sqlConfig);
            await this.pool.connect();
            console.log('✅ Conectado ao banco de dados SQL Server');
            logger_1.Logger.success('Conexão com banco de dados estabelecida');
        }
        catch (error) {
            console.error('❌ Erro ao conectar ao banco de dados:', error);
            logger_1.Logger.error('Erro na conexão com banco de dados', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
            throw error;
        }
    }
    async disconnect() {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
            console.log('🔌 Desconectado do banco de dados');
        }
    }
    isConnected() {
        return this.pool !== null && this.pool.connected;
    }
    async inserirDadosTESSCompletos(data) {
        if (!this.pool) {
            throw new Error('Não conectado ao banco de dados');
        }
        const transaction = new sql.Transaction(this.pool);
        await transaction.begin();
        try {
            console.log('📝 Inserindo consulta TESS...');
            let consultaTESSId;
            try {
                consultaTESSId = await this.inserirConsultaTESS(data.consulta, transaction);
                console.log(`✅ Consulta TESS inserida com ID: ${consultaTESSId}`);
            }
            catch (error) {
                console.error('❌ Erro ao inserir consulta TESS:', error);
                throw error;
            }
            console.log('🏢 Inserindo empresa...');
            let empresaId;
            try {
                empresaId = await this.inserirEmpresa(data.empresa, transaction);
                console.log(`✅ Empresa inserida com ID: ${empresaId}`);
            }
            catch (error) {
                console.error('❌ Erro ao inserir empresa:', error);
                throw error;
            }
            console.log('🔗 Inserindo consulta empresa...');
            let consultaEmpresaId;
            try {
                consultaEmpresaId = await this.inserirConsultaEmpresa({
                    consultaTESSId,
                    empresaId,
                    dataConsulta: data.consulta.dataConsulta,
                    arquivoPDF: data.consulta.arquivoPDF,
                    respostaTESS: data.consulta.respostaTESS,
                    creditosUtilizados: data.consulta.creditosUtilizados
                }, transaction);
                console.log(`✅ Consulta empresa inserida com ID: ${consultaEmpresaId}`);
            }
            catch (error) {
                console.error('❌ Erro ao inserir consulta empresa:', error);
                throw error;
            }
            console.log('👥 Inserindo sócios...');
            const sociosIds = [];
            for (let i = 0; i < data.socios.length; i++) {
                try {
                    const socioId = await this.inserirSocio(data.socios[i], empresaId, transaction);
                    sociosIds.push(socioId);
                    console.log(`✅ Sócio ${i + 1}/${data.socios.length} inserido com ID: ${socioId}`);
                }
                catch (error) {
                    console.error(`❌ Erro ao inserir sócio ${i + 1}:`, error);
                    throw error;
                }
            }
            console.log('📊 Inserindo participações societárias...');
            const participacoesIds = [];
            for (let i = 0; i < data.participacoes.length; i++) {
                try {
                    const participacao = data.participacoes[i];
                    const socioId = sociosIds[i] || sociosIds[0];
                    const participacaoId = await this.inserirParticipacaoSocietaria({
                        socioId,
                        empresaId,
                        consultaEmpresaId,
                        participacaoPercentual: participacao.participacaoPercentual,
                        cargo: participacao.cargo,
                        dataEntrada: participacao.dataEntrada,
                        dataSaida: participacao.dataSaida,
                        statusParticipacao: participacao.statusParticipacao
                    }, transaction);
                    participacoesIds.push(participacaoId);
                    console.log(`✅ Participação ${i + 1}/${data.participacoes.length} inserida com ID: ${participacaoId}`);
                }
                catch (error) {
                    console.error(`❌ Erro ao inserir participação ${i + 1}:`, error);
                    throw error;
                }
            }
            console.log('🏢 Inserindo quadro administrativo...');
            const quadroIds = [];
            for (let i = 0; i < data.quadroAdministrativo.length; i++) {
                try {
                    const quadro = data.quadroAdministrativo[i];
                    const socioId = sociosIds[i] || sociosIds[0];
                    const quadroId = await this.inserirQuadroAdministrativo({
                        socioId,
                        empresaId,
                        consultaEmpresaId,
                        cargo: quadro.cargo,
                        dataEleicao: quadro.dataEleicao,
                        statusCargo: quadro.statusCargo
                    }, transaction);
                    quadroIds.push(quadroId);
                    console.log(`✅ Quadro ${i + 1}/${data.quadroAdministrativo.length} inserido com ID: ${quadroId}`);
                }
                catch (error) {
                    console.error(`❌ Erro ao inserir quadro ${i + 1}:`, error);
                    throw error;
                }
            }
            await transaction.commit();
            console.log(`✅ Dados inseridos com sucesso no banco de dados`);
            console.log(`   - Consulta TESS ID: ${consultaTESSId}`);
            console.log(`   - Empresa ID: ${empresaId}`);
            console.log(`   - Consulta Empresa ID: ${consultaEmpresaId}`);
            console.log(`   - Sócios: ${sociosIds.length}`);
            console.log(`   - Participações: ${participacoesIds.length}`);
            console.log(`   - Quadro Administrativo: ${quadroIds.length}`);
            logger_1.Logger.success('Dados TESS inseridos no banco de dados', {
                consultaTESSId,
                empresaId,
                consultaEmpresaId,
                sociosCount: sociosIds.length,
                participacoesCount: participacoesIds.length,
                quadroCount: quadroIds.length
            });
            return {
                consultaTESSId,
                empresaId,
                consultaEmpresaId,
                sociosIds,
                participacoesIds,
                quadroIds
            };
        }
        catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao inserir dados no banco:', error);
            if (error instanceof Error) {
                console.error('❌ Mensagem do erro:', error.message);
                console.error('❌ Stack trace:', error.stack);
                if ('code' in error) {
                    console.error('❌ Código do erro:', error.code);
                    console.error('❌ Número do erro:', error.number);
                    console.error('❌ Estado do erro:', error.state);
                    console.error('❌ Classe do erro:', error.class);
                    console.error('❌ Server name:', error.serverName);
                    console.error('❌ Procedure name:', error.procName);
                }
                if (error.message.includes('Transaction has been aborted')) {
                    console.error('❌ ERRO DE TRANSAÇÃO: Uma stored procedure falhou e abortou a transação');
                    console.error('❌ Verifique os logs anteriores para identificar qual procedure falhou');
                }
            }
            logger_1.Logger.error('Erro ao inserir dados TESS no banco', {
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                details: error instanceof Error ? error.stack : undefined
            });
            throw error;
        }
    }
    async inserirConsultaTESS(data, transaction) {
        const request = new sql.Request(transaction);
        const fileId = `TESS_${data.cnpj.replace(/[^\d]/g, '')}_${Date.now()}`;
        request.input('FileID', sql.VarChar(50), fileId);
        request.input('ProtocoloConsulta', sql.VarChar(50), `PROT_${Date.now()}`);
        request.input('ArquivoPDFOrigem', sql.VarChar(255), data.arquivoPDF || '');
        request.input('OperadorConsulta', sql.VarChar(100), 'SISTEMA_AUTOMATICO');
        request.input('DataHoraConsulta', sql.DateTime2, data.dataConsulta);
        request.input('ProdutoConsultado', sql.VarChar(100), 'SPC + POSITIVO AVANÇADO PJ');
        request.input('CreditosUtilizados', sql.Decimal(10, 6), data.creditosUtilizados || 0);
        request.input('StatusConsulta', sql.VarChar(20), 'PROCESSADA');
        request.input('Observacoes', sql.NVarChar(500), `Consulta automática para CNPJ: ${data.cnpj}`);
        request.input('UsuarioImportacao', sql.VarChar(100), 'SISTEMA_TESS');
        const result = await request.execute('sp_InserirConsultaTESS');
        return result.recordset[0].ConsultaID;
    }
    async inserirEmpresa(data, transaction) {
        const request = new sql.Request(transaction);
        request.input('CNPJ', sql.VarChar(18), data.cnpj);
        request.input('RazaoSocial', sql.VarChar(255), data.razaoSocial || '');
        request.input('NomeFantasia', sql.VarChar(255), data.nomeFantasia || null);
        request.input('SituacaoCNPJ', sql.VarChar(50), data.situacaoCadastral || 'ATIVA');
        request.input('DataFundacao', sql.Date, data.dataAbertura || null);
        request.input('PorteEmpresa', sql.VarChar(20), data.porte || null);
        let logradouro = data.endereco || null;
        let numero = null;
        let complemento = null;
        let bairro = null;
        if (data.endereco) {
            const enderecoParts = data.endereco.split(/\s+/);
            if (enderecoParts.length > 1) {
                const numeroMatch = enderecoParts.find(part => /^\d+/.test(part));
                if (numeroMatch) {
                    numero = numeroMatch;
                    const numeroIndex = enderecoParts.indexOf(numeroMatch);
                    logradouro = enderecoParts.slice(0, numeroIndex).join(' ');
                    complemento = enderecoParts.slice(numeroIndex + 1).join(' ');
                }
            }
        }
        request.input('Logradouro', sql.VarChar(255), logradouro);
        request.input('Numero', sql.VarChar(20), numero);
        request.input('Complemento', sql.VarChar(100), complemento);
        request.input('Bairro', sql.VarChar(100), bairro);
        request.input('Cidade', sql.VarChar(100), data.municipio || null);
        request.input('Estado', sql.Char(2), data.uf || null);
        request.input('CEP', sql.VarChar(10), data.cep || null);
        let telefonesFixosJSON = null;
        let telefonesCelularesJSON = null;
        let emailsJSON = null;
        if (data.telefone) {
            const telefones = data.telefone.split(/[,;]/).map(tel => tel.trim()).filter(tel => tel.length > 0);
            if (telefones.length > 0) {
                telefonesFixosJSON = JSON.stringify(telefones);
            }
        }
        if (data.email) {
            const emails = data.email.split(/[,;]/).map(email => email.trim()).filter(email => email.length > 0);
            if (emails.length > 0) {
                emailsJSON = JSON.stringify(emails);
            }
        }
        request.input('TelefonesFixos', sql.NVarChar(sql.MAX), telefonesFixosJSON);
        request.input('TelefonesCelulares', sql.NVarChar(sql.MAX), telefonesCelularesJSON);
        request.input('Emails', sql.NVarChar(sql.MAX), emailsJSON);
        request.input('StatusEmpresa', sql.VarChar(20), 'ATIVA');
        request.input('UsuarioCadastro', sql.VarChar(100), 'SISTEMA_TESS');
        const result = await request.execute('sp_InserirEmpresa');
        return result.recordset[0].EmpresaID;
    }
    async inserirConsultaEmpresa(data, transaction) {
        const request = new sql.Request(transaction);
        request.input('ConsultaTESSId', sql.Int, data.consultaTESSId);
        request.input('EmpresaId', sql.Int, data.empresaId);
        request.input('DataConsulta', sql.DateTime2(3), data.dataConsulta);
        request.input('ArquivoPDF', sql.VarChar(255), data.arquivoPDF);
        request.input('RespostaTESS', sql.NVarChar(sql.MAX), data.respostaTESS || null);
        request.input('CreditosUtilizados', sql.Decimal(10, 6), data.creditosUtilizados || 0);
        const result = await request.execute('sp_InserirConsultaEmpresa');
        return result.recordset[0].ConsultaEmpresaID;
    }
    async insertCompanyData(data) {
        if (!this.pool) {
            throw new Error('Não conectado ao banco de dados');
        }
        const transaction = new sql.Transaction(this.pool);
        try {
            await transaction.begin();
            console.log('Iniciando inserção de dados da empresa no banco...');
            const consultaId = await this.inserirConsulta(data, transaction);
            const empresaId = await this.inserirEmpresaCompleta(data, consultaId, transaction);
            if (data.latitude && data.longitude) {
                await this.inserirEnderecoCompleto(data, empresaId, transaction);
            }
            if (data.telefone || data.email) {
                await this.inserirDadosContatoCompleto(data, empresaId, transaction);
            }
            await transaction.commit();
            console.log(`✅ Dados da empresa ${data.cnpj} inseridos com sucesso. ID: ${empresaId}`);
            return { success: true, empresaId };
        }
        catch (error) {
            await transaction.rollback();
            console.error('Erro ao inserir dados da empresa:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido'
            };
        }
        finally {
        }
    }
    async inserirConsulta(data, transaction) {
        const request = new sql.Request(transaction);
        request.input('Operador', sql.VarChar(255), 'SISTEMA_INTEGRADO');
        request.input('DataHora', sql.DateTime2(3), data.data_consulta);
        request.input('Produto', sql.VarChar(255), 'SPC_TESS_CNPJA_INTEGRADO');
        request.input('Protocolo', sql.VarChar(50), `INT_${Date.now()}`);
        const result = await request.execute('sp_InserirConsulta');
        return result.recordset[0].ConsultaID;
    }
    async inserirEmpresaCompleta(data, consultaId, transaction) {
        const request = new sql.Request(transaction);
        request.input('CNPJ', sql.VarChar(18), data.cnpj);
        request.input('InscricaoEstadual', sql.VarChar(50), data.inscricao_estadual || null);
        request.input('InscricaoSuframa', sql.VarChar(50), data.inscricao_suframa || null);
        request.input('RazaoSocial', sql.VarChar(500), data.razao_social || 'N/A');
        request.input('NomeFantasia', sql.VarChar(500), data.nome_fantasia || null);
        request.input('SituacaoCNPJ', sql.VarChar(50), data.situacao || null);
        request.input('Porte', sql.VarChar(100), data.porte || null);
        request.input('NaturezaJuridica', sql.VarChar(200), data.natureza_juridica || null);
        request.input('CapitalSocial', sql.Decimal(15, 2), data.capital_social || null);
        request.input('AtividadePrincipal', sql.VarChar(500), data.atividade_principal || null);
        request.input('Atualizacao', sql.DateTime2(3), data.data_consulta);
        request.input('Fundacao', sql.Date, data.data_abertura ? new Date(data.data_abertura) : null);
        request.input('IdConsulta', sql.Int, consultaId);
        request.input('CnpjaResponse', sql.NVarChar(sql.MAX), data.cnpja_response || null);
        const result = await request.execute('sp_InserirEmpresa');
        return result.recordset[0].EmpresaID;
    }
    async inserirEnderecoCompleto(data, empresaId, transaction) {
        const request = new sql.Request(transaction);
        const enderecoParts = data.endereco_completo?.split(',') || [];
        request.input('IdEmpresa', sql.Int, empresaId);
        request.input('Logradouro', sql.VarChar(255), enderecoParts[0]?.trim() || null);
        request.input('Numero', sql.VarChar(20), enderecoParts[1]?.trim() || null);
        request.input('Complemento', sql.VarChar(255), enderecoParts[2]?.trim() || null);
        request.input('Bairro', sql.VarChar(100), enderecoParts[3]?.trim() || null);
        request.input('Cidade', sql.VarChar(100), enderecoParts[4]?.trim() || null);
        request.input('Estado', sql.Char(2), enderecoParts[5]?.trim() || null);
        request.input('CEP', sql.VarChar(10), enderecoParts[6]?.trim() || null);
        request.input('Longitude', sql.Decimal(10, 8), data.longitude);
        request.input('Latitude', sql.Decimal(10, 8), data.latitude);
        await request.execute('sp_InserirEndereco');
    }
    async inserirDadosContatoCompleto(data, empresaId, transaction) {
        const request = new sql.Request(transaction);
        let telefonesFixosJSON = null;
        let telefonesCelularesJSON = null;
        let emailsJSON = null;
        if (data.telefone) {
            const telefones = data.telefone.split(/[,;]/).map((t) => t.trim()).filter((t) => t.length > 0);
            if (telefones.length > 0) {
                telefonesFixosJSON = JSON.stringify(telefones);
            }
        }
        if (data.email) {
            const emails = data.email.split(/[,;]/).map((e) => e.trim()).filter((e) => e.length > 0);
            if (emails.length > 0) {
                emailsJSON = JSON.stringify(emails);
            }
        }
        request.input('IdEmpresa', sql.Int, empresaId);
        request.input('TelefonesFixos', sql.NVarChar(sql.MAX), telefonesFixosJSON);
        request.input('TelefonesCelulares', sql.NVarChar(sql.MAX), telefonesCelularesJSON);
        request.input('Emails', sql.NVarChar(sql.MAX), emailsJSON);
        await request.execute('sp_InserirDadosContato');
    }
    async inserirSocio(data, empresaId, transaction) {
        const request = new sql.Request(transaction);
        request.input('CPF_CNPJ', sql.VarChar(18), data.cpfCnpj || '');
        request.input('Nome', sql.VarChar(255), data.nome || '');
        request.input('TipoPessoa', sql.Char(1), data.tipoPessoa || 'F');
        request.input('EmpresaID', sql.Int, empresaId);
        request.input('DataNascimento', sql.Date, null);
        request.input('Telefone', sql.VarChar(20), null);
        request.input('Email', sql.VarChar(255), null);
        request.input('Logradouro', sql.VarChar(255), null);
        request.input('Numero', sql.VarChar(20), null);
        request.input('Complemento', sql.VarChar(100), null);
        request.input('Bairro', sql.VarChar(100), null);
        request.input('Cidade', sql.VarChar(100), null);
        request.input('Estado', sql.Char(2), null);
        request.input('CEP', sql.VarChar(10), null);
        request.input('StatusSocio', sql.VarChar(20), data.statusSocio || 'ATIVO');
        request.input('UsuarioCadastro', sql.VarChar(100), 'SISTEMA_TESS');
        const result = await request.execute('sp_InserirSocio');
        return result.recordset[0].SocioID;
    }
    async inserirParticipacaoSocietaria(data, transaction) {
        const request = new sql.Request(transaction);
        request.input('SocioID', sql.Int, data.socioId);
        request.input('EmpresaID', sql.Int, data.empresaId);
        request.input('ConsultaEmpresaID', sql.Int, data.consultaEmpresaId);
        request.input('ParticipacaoPercentual', sql.Decimal(5, 2), data.participacaoPercentual);
        request.input('Cargo', sql.VarChar(100), data.cargo);
        request.input('DataEntrada', sql.Date, data.dataEntrada);
        request.input('DataSaida', sql.Date, data.dataSaida);
        request.input('StatusParticipacao', sql.VarChar(20), data.statusParticipacao || 'ATIVA');
        const result = await request.execute('sp_InserirParticipacaoSocietaria');
        return result.recordset[0].ParticipacaoID;
    }
    async inserirQuadroAdministrativo(data, transaction) {
        const request = new sql.Request(transaction);
        request.input('SocioID', sql.Int, data.socioId);
        request.input('EmpresaID', sql.Int, data.empresaId);
        request.input('ConsultaEmpresaID', sql.Int, data.consultaEmpresaId);
        request.input('Cargo', sql.VarChar(100), data.cargo);
        request.input('DataEleicao', sql.Date, data.dataEleicao);
        request.input('DataFimMandato', sql.Date, null);
        request.input('StatusCargo', sql.VarChar(20), data.statusCargo || 'ATIVO');
        const result = await request.execute('sp_InserirQuadroAdministrativo');
        return result.recordset[0].QuadroID;
    }
    async buscarDadosConsolidados(cnpj) {
        if (!this.pool) {
            throw new Error('Não conectado ao banco de dados');
        }
        const request = new sql.Request(this.pool);
        request.input('cnpj', sql.VarChar(18), cnpj);
        const result = await request.execute('sp_BuscarDadosConsolidados');
        return result.recordset;
    }
    async listarEmpresasParaAnalise() {
        if (!this.pool) {
            throw new Error('Não conectado ao banco de dados');
        }
        const request = new sql.Request(this.pool);
        const result = await request.execute('sp_ListarEmpresasParaAnalise');
        return result.recordset;
    }
    async testConnection() {
        try {
            if (!this.pool) {
                await this.connect();
            }
            const request = new sql.Request(this.pool);
            const result = await request.query('SELECT 1 as test');
            console.log('✅ Teste de conexão com banco de dados: OK');
            return true;
        }
        catch (error) {
            console.error('❌ Teste de conexão com banco de dados: FALHA', error);
            return false;
        }
    }
    async query(sqlQuery) {
        if (!this.pool) {
            throw new Error('Não conectado ao banco de dados');
        }
        const request = new sql.Request(this.pool);
        const result = await request.query(sqlQuery);
        return result.recordset;
    }
    async testStoredProcedures() {
        try {
            if (!this.pool) {
                await this.connect();
            }
            const request = new sql.Request(this.pool);
            const procedures = [
                'sp_InserirConsultaTESS',
                'sp_InserirEmpresa',
                'sp_InserirConsultaEmpresa',
                'sp_InserirSocio',
                'sp_InserirParticipacaoSocietaria',
                'sp_InserirQuadroAdministrativo'
            ];
            for (const procName of procedures) {
                const result = await request.query(`
          SELECT COUNT(*) as count 
          FROM sys.procedures 
          WHERE name = '${procName}'
        `);
                const count = result.recordset[0].count;
                if (count === 0) {
                    console.error(`❌ Stored procedure '${procName}' não encontrada`);
                    return false;
                }
                else {
                    console.log(`✅ Stored procedure '${procName}' encontrada`);
                }
            }
            console.log('✅ Todas as stored procedures estão disponíveis');
            return true;
        }
        catch (error) {
            console.error('❌ Erro ao testar stored procedures:', error);
            return false;
        }
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=databaseService.js.map