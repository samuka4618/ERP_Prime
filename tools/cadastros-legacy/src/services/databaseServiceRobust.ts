import * as sql from 'mssql';
import { Logger } from '../utils/logger';
import { DadosTESSCompletos } from '../types/tessTypes';

export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

export class DatabaseServiceRobust {
  private config: DatabaseConfig;
  private pool: sql.ConnectionPool | null = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Conecta ao banco de dados
   */
  async connect(): Promise<void> {
    try {
      const sqlConfig: sql.config = {
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
      
      console.log('✅ Conectado ao banco de dados SQL Server (Versão Robusta)');
      Logger.success('Conexão com banco de dados estabelecida');
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco de dados:', error);
      Logger.error('Erro na conexão com banco de dados', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      throw error;
    }
  }

  /**
   * Desconecta do banco de dados
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      console.log('🔌 Desconectado do banco de dados');
    }
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.pool !== null && this.pool.connected;
  }

  /**
   * Insere dados completos de uma consulta TESS usando o novo schema com tratamento robusto de erros
   */
  async inserirDadosTESSCompletos(dados: DadosTESSCompletos): Promise<{
    consultaId: number;
    empresaId: number;
    enderecoId: number | null;
    dadosContatoId: number | null;
    ocorrenciasId: number | null;
    sociosIds: number[];
    quadroIds: number[];
    historicoPagamentoId: number | null;
    scoreCreditoId: number | null;
    scrId: number | null;
    consultasRealizadasIds: number[];
    tiposGarantiasIds: number[];
  }> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    try {
      console.log('🔄 Iniciando transação para inserção de dados...');
      
      // 1. Inserir Consulta
      console.log('📝 Inserindo consulta...');
      const consultaId = await this.inserirConsultaComRetry(dados.consulta, transaction);
      console.log(`✅ Consulta inserida com ID: ${consultaId}`);

      // 2. Inserir Empresa
      console.log('🏢 Inserindo empresa...');
      const empresaId = await this.inserirEmpresaComRetry(dados.empresa, consultaId, transaction);
      console.log(`✅ Empresa inserida com ID: ${empresaId}`);

      // 3. Inserir Endereço (opcional)
      console.log('📍 Inserindo endereço...');
      const enderecoId = await this.inserirEnderecoComRetry(dados.endereco, empresaId, transaction);
      console.log(`✅ Endereço inserido com ID: ${enderecoId}`);

      // 4. Inserir Dados de Contato (opcional)
      console.log('📞 Inserindo dados de contato...');
      const dadosContatoId = await this.inserirDadosContatoComRetry(dados.dados_contato, empresaId, transaction);
      console.log(`✅ Dados de contato inseridos com ID: ${dadosContatoId}`);

      // 5. Inserir Ocorrências (opcional)
      console.log('📊 Inserindo ocorrências...');
      const ocorrenciasId = await this.inserirOcorrenciasComRetry(dados.ocorrencias, empresaId, transaction);
      console.log(`✅ Ocorrências inseridas com ID: ${ocorrenciasId}`);

      // 6. Limpar e Inserir Sócios (pode ter mudado)
      console.log('👥 Limpando sócios antigos e inserindo novos...');
      // Limpar sócios existentes antes de inserir novos
      await transaction.request().query(`DELETE FROM socios WHERE id_empresa = ${empresaId}`);
      console.log('🗑️ Sócios antigos removidos');
      
      const sociosIds: number[] = [];
      for (let i = 0; i < dados.socios.length; i++) {
        try {
          const socioId = await this.inserirSocioComRetry(dados.socios[i], empresaId, transaction);
          sociosIds.push(socioId);
          console.log(`✅ Sócio ${i + 1}/${dados.socios.length} inserido com ID: ${socioId}`);
        } catch (error) {
          console.warn(`⚠️ Erro ao inserir sócio ${i + 1}, continuando...`, error);
        }
      }

      // 7. Limpar e Inserir Quadro Administrativo (pode ter mudado)
      console.log('🏢 Limpando quadro administrativo antigo e inserindo novo...');
      // Limpar quadro administrativo existente antes de inserir novo
      await transaction.request().query(`DELETE FROM quadro_administrativo WHERE id_empresa = ${empresaId}`);
      console.log('🗑️ Quadro administrativo antigo removido');
      
      const quadroIds: number[] = [];
      for (let i = 0; i < dados.quadro_administrativo.length; i++) {
        try {
          const quadroId = await this.inserirQuadroAdministrativoComRetry(dados.quadro_administrativo[i], empresaId, transaction);
          quadroIds.push(quadroId);
          console.log(`✅ Quadro ${i + 1}/${dados.quadro_administrativo.length} inserido com ID: ${quadroId}`);
        } catch (error) {
          console.warn(`⚠️ Erro ao inserir quadro ${i + 1}, continuando...`, error);
        }
      }

      // 8. Inserir Histórico de Pagamento Positivo (opcional)
      console.log('💰 Inserindo histórico de pagamento positivo...');
      const historicoPagamentoId = await this.inserirHistoricoPagamentoPositivoComRetry(dados.historico_pagamento_positivo, empresaId, transaction);
      console.log(`✅ Histórico de pagamento inserido com ID: ${historicoPagamentoId}`);

      // 9. Inserir Score de Crédito (opcional)
      console.log('📈 Inserindo score de crédito...');
      const scoreCreditoId = await this.inserirScoreCreditoComRetry(dados.score_credito, empresaId, transaction);
      console.log(`✅ Score de crédito inserido com ID: ${scoreCreditoId}`);

      // 10. Inserir SCR (opcional)
      console.log('🏦 Inserindo dados SCR...');
      const scrId = await this.inserirSCRComRetry(dados.scr, empresaId, transaction);
      console.log(`✅ SCR inserido com ID: ${scrId}`);

      // 11. Inserir Consultas Realizadas
      console.log('🔍 Inserindo consultas realizadas...');
      const consultasRealizadasIds: number[] = [];
      for (let i = 0; i < dados.consultas_realizadas.length; i++) {
        try {
          const consultaRealizadaId = await this.inserirConsultaRealizadaComRetry(dados.consultas_realizadas[i], empresaId, transaction);
          consultasRealizadasIds.push(consultaRealizadaId);
          console.log(`✅ Consulta realizada ${i + 1}/${dados.consultas_realizadas.length} inserida com ID: ${consultaRealizadaId}`);
        } catch (error) {
          console.warn(`⚠️ Erro ao inserir consulta realizada ${i + 1}, continuando...`, error);
        }
      }

      // 12. Limpar e Inserir Tipos de Garantias (apenas se SCR foi inserido/atualizado)
      console.log('🛡️ Processando tipos de garantias...');
      const tiposGarantiasIds: number[] = [];
      if (scrId) {
        // Limpar garantias antigas do SCR
        const deleteRequest = new sql.Request(transaction);
        await deleteRequest.query(`DELETE FROM tipos_garantias WHERE id_scr = ${scrId}`);
        console.log('🗑️ Tipos de garantias antigos removidos');
        
        for (let i = 0; i < dados.tipos_garantias.length; i++) {
          try {
            const tipoGarantiaId = await this.inserirTipoGarantiaComRetry(dados.tipos_garantias[i], scrId, transaction);
            tiposGarantiasIds.push(tipoGarantiaId);
            console.log(`✅ Tipo de garantia ${i + 1}/${dados.tipos_garantias.length} inserido com ID: ${tipoGarantiaId}`);
          } catch (error) {
            console.warn(`⚠️ Erro ao inserir tipo de garantia ${i + 1}, continuando...`, error);
          }
        }
      }

      await transaction.commit();
      console.log('✅ Transação commitada com sucesso!');

      console.log(`✅ Dados inseridos com sucesso no banco de dados (Versão Robusta)`);
      console.log(`   - Consulta ID: ${consultaId}`);
      console.log(`   - Empresa ID: ${empresaId}`);
      console.log(`   - Sócios: ${sociosIds.length}`);
      console.log(`   - Quadro Administrativo: ${quadroIds.length}`);
      console.log(`   - Consultas Realizadas: ${consultasRealizadasIds.length}`);
      console.log(`   - Tipos de Garantias: ${tiposGarantiasIds.length}`);

      Logger.success('Dados TESS inseridos no banco (Versão Robusta)', {
        consultaId,
        empresaId,
        sociosCount: sociosIds.length,
        quadroCount: quadroIds.length,
        consultasCount: consultasRealizadasIds.length
      });

      return {
        consultaId,
        empresaId,
        enderecoId,
        dadosContatoId,
        ocorrenciasId,
        sociosIds,
        quadroIds,
        historicoPagamentoId,
        scoreCreditoId,
        scrId,
        consultasRealizadasIds,
        tiposGarantiasIds
      };

    } catch (error) {
      console.error('❌ Erro durante a transação, fazendo rollback...');
      await transaction.rollback();
      
      // Log detalhado do erro
      if (error instanceof Error) {
        console.error('❌ Mensagem do erro:', error.message);
        console.error('❌ Stack trace:', error.stack);
        
        // Se for erro de SQL Server, mostrar detalhes específicos
        if ('code' in error) {
          console.error('❌ Código do erro:', (error as any).code);
          console.error('❌ Número do erro:', (error as any).number);
          console.error('❌ Severidade:', (error as any).severity);
          console.error('❌ Estado:', (error as any).state);
          console.error('❌ Nome do servidor:', (error as any).serverName);
          console.error('❌ Procedimento:', (error as any).procName);
          console.error('❌ Linha:', (error as any).lineNumber);
        }
        
        // Se for erro de Request, mostrar os parâmetros
        if (error.message.includes('Parameter')) {
          console.error('❌ ERRO DE PARÂMETRO SQL DETECTADO!');
          console.error('❌ Verifique os tipos e comprimentos dos parâmetros enviados');
          console.error('❌ Stack completo:', error.stack);
        }
      }
      
      Logger.error('Erro ao inserir dados TESS (Versão Robusta)', { 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Re-throw com mensagem mais clara
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      throw new Error(`Erro ao inserir dados no banco: ${errorMessage}`);
    }
  }

  // Métodos de inserção com retry e tratamento de erro

  private async inserirConsultaComRetry(consulta: any, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('operador', sql.VarChar(255), consulta.operador);
      request.input('data_hora', sql.DateTime, consulta.data_hora);
      request.input('produto', sql.VarChar(255), consulta.produto);
      request.input('protocolo', sql.VarChar(50), consulta.protocolo);

      const result = await request.query(`
        INSERT INTO consulta (operador, data_hora, produto, protocolo)
        OUTPUT INSERTED.id
        VALUES (@operador, @data_hora, @produto, @protocolo)
      `);

      return result.recordset[0].id;
    } catch (error) {
      console.error('❌ Erro ao inserir consulta:', error);
      throw error;
    }
  }

  private async inserirEmpresaComRetry(empresa: any, consultaId: number, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('cnpj', sql.VarChar(18), empresa.cnpj);
      request.input('inscricao_estadual', sql.VarChar(50), empresa.inscricao_estadual);
      request.input('razao_social', sql.VarChar(500), empresa.razao_social);
      request.input('situacao_cnpj', sql.VarChar(50), empresa.situacao_cnpj);
      request.input('atualizacao', sql.DateTime, empresa.atualizacao);
      request.input('fundacao', sql.Date, empresa.fundacao);
      request.input('id_consulta', sql.Int, consultaId);

      // Verificar se empresa já existe
      const checkResult = await request.query(`
        SELECT id FROM empresa WHERE cnpj = @cnpj
      `);

      let empresaId: number;

      if (checkResult.recordset.length > 0) {
        // Empresa existe - atualizar
        empresaId = checkResult.recordset[0].id;
        console.log(`📝 Empresa já existe (ID: ${empresaId}), atualizando dados...`);
        
        await request.query(`
          UPDATE empresa 
          SET 
            inscricao_estadual = @inscricao_estadual,
            razao_social = @razao_social,
            situacao_cnpj = @situacao_cnpj,
            atualizacao = @atualizacao,
            fundacao = @fundacao,
            id_consulta = @id_consulta,
            updated_at = GETDATE()
          WHERE cnpj = @cnpj
        `);
        console.log(`✅ Empresa atualizada (ID: ${empresaId})`);
      } else {
        // Empresa não existe - inserir
        console.log('📝 Empresa não existe, inserindo novo registro...');
        const insertResult = await request.query(`
          INSERT INTO empresa (cnpj, inscricao_estadual, razao_social, situacao_cnpj, atualizacao, fundacao, id_consulta)
          OUTPUT INSERTED.id
          VALUES (@cnpj, @inscricao_estadual, @razao_social, @situacao_cnpj, @atualizacao, @fundacao, @id_consulta)
        `);
        empresaId = insertResult.recordset[0].id;
        console.log(`✅ Nova empresa inserida (ID: ${empresaId})`);
      }

      return empresaId;
    } catch (error) {
      console.error('❌ Erro ao inserir/atualizar empresa:', error);
      throw error;
    }
  }

  private async inserirEnderecoComRetry(endereco: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de endereço para inserir
      if (!endereco || (!endereco.logradouro && !endereco.cidade)) {
        console.log('⚠️ Dados de endereço vazios, pulando inserção');
        return null;
      }

      const request = new sql.Request(transaction);
      
      // Função auxiliar para normalizar strings
      const normalizeString = (value: any, maxLength: number = 255): string | null => {
        if (!value) return null;
        const str = String(value).trim();
        return str.length > 0 ? str.substring(0, maxLength) : null;
      };
      
      // Normalizar estado para garantir máximo 2 caracteres ou NULL
      const estadoNormalizado = endereco.estado 
        ? String(endereco.estado).substring(0, 2).toUpperCase() 
        : null;
      
      request.input('id_empresa', sql.Int, empresaId);
      request.input('logradouro', sql.VarChar(255), normalizeString(endereco.logradouro, 255));
      request.input('numero', sql.VarChar(20), normalizeString(endereco.numero, 20));
      request.input('complemento', sql.VarChar(255), normalizeString(endereco.complemento, 255));
      request.input('bairro', sql.VarChar(100), normalizeString(endereco.bairro, 100));
      request.input('cidade', sql.VarChar(100), normalizeString(endereco.cidade, 100));
      request.input('estado', sql.VarChar(2), estadoNormalizado);
      request.input('cep', sql.VarChar(10), normalizeString(endereco.cep, 10));
      
      // Tratar latitude e longitude - campos DECIMAL não aceitam null, usar 0 se não existir
      const longitude = endereco.longitude ? parseFloat(String(endereco.longitude)) : 0;
      const latitude = endereco.latitude ? parseFloat(String(endereco.latitude)) : 0;
      
      request.input('longitude', sql.Decimal(10, 8), longitude);
      request.input('latitude', sql.Decimal(10, 8), latitude);

      // Log dos valores para debug
      console.log('📍 Inserindo endereço com valores:', {
        id_empresa: empresaId,
        estado: estadoNormalizado,
        cidade: normalizeString(endereco.cidade, 100),
        logradouro: normalizeString(endereco.logradouro, 255),
        longitude,
        latitude
      });

      // Verificar se já existe endereço para esta empresa
      const checkEndereco = await request.query(`
        SELECT TOP 1 id FROM endereco WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkEndereco.recordset.length > 0) {
        // Atualizar endereço existente
        const enderecoId = checkEndereco.recordset[0].id;
        console.log(`📍 Endereço já existe (ID: ${enderecoId}), atualizando...`);
        await request.query(`
          UPDATE endereco 
          SET 
            logradouro = @logradouro,
            numero = @numero,
            complemento = @complemento,
            bairro = @bairro,
            cidade = @cidade,
            estado = @estado,
            cep = @cep,
            longitude = @longitude,
            latitude = @latitude,
            updated_at = GETDATE()
          WHERE id = ${enderecoId}
        `);
        return enderecoId;
      } else {
        // Inserir novo endereço
        const result = await request.query(`
          INSERT INTO endereco (id_empresa, logradouro, numero, complemento, bairro, cidade, estado, cep, longitude, latitude)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @logradouro, @numero, @complemento, @bairro, @cidade, @estado, @cep, @longitude, @latitude)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir endereço:', error);
      throw error;
    }
  }

  private async inserirDadosContatoComRetry(dadosContato: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de contato para inserir
      if (!dadosContato || (!dadosContato.telefones_fixos && !dadosContato.telefones_celulares && !dadosContato.emails)) {
        console.log('⚠️ Dados de contato vazios, pulando inserção');
        return null;
      }

      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('telefones_fixos', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.telefones_fixos || []));
      request.input('telefones_celulares', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.telefones_celulares || []));
      request.input('emails', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.emails || []));

      // Verificar se já existe dados de contato para esta empresa
      const checkContato = await request.query(`
        SELECT TOP 1 id FROM dados_contato WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkContato.recordset.length > 0) {
        // Atualizar contato existente
        const contatoId = checkContato.recordset[0].id;
        console.log(`📞 Dados de contato já existem (ID: ${contatoId}), atualizando...`);
        await request.query(`
          UPDATE dados_contato 
          SET 
            telefones_fixos = @telefones_fixos,
            telefones_celulares = @telefones_celulares,
            emails = @emails,
            updated_at = GETDATE()
          WHERE id = ${contatoId}
        `);
        return contatoId;
      } else {
        // Inserir novo contato
        const result = await request.query(`
          INSERT INTO dados_contato (id_empresa, telefones_fixos, telefones_celulares, emails)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @telefones_fixos, @telefones_celulares, @emails)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir dados de contato:', error);
      throw error;
    }
  }

  private async inserirOcorrenciasComRetry(ocorrencias: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de ocorrências para inserir
      if (!ocorrencias || Object.keys(ocorrencias).length === 0) {
        console.log('⚠️ Dados de ocorrências vazios, pulando inserção');
        console.log('   Detalhes:', { ocorrencias, tipo: typeof ocorrencias, keys: ocorrencias ? Object.keys(ocorrencias) : [] });
        return null;
      }
      
      console.log(`📊 Processando ocorrências para empresa ${empresaId}:`, JSON.stringify(ocorrencias, null, 2));

      // Função helper para converter objeto/array para flag numérico (1 se existe dados, 0 se vazio/null)
      const toIntFlag = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value ? 1 : 0;
        if (typeof value === 'object') {
          // Se é objeto ou array, verifica se tem conteúdo
          if (Array.isArray(value)) return value.length > 0 ? 1 : 0;
          return Object.keys(value).length > 0 ? 1 : 0;
        }
        if (typeof value === 'string') return value.trim().length > 0 ? 1 : 0;
        return 0;
      };

      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('score_pj', sql.Int, ocorrencias.score_pj || 0);
      request.input('dados_contato', sql.Int, toIntFlag(ocorrencias.dados_contato));
      request.input('historico_scr', sql.Int, toIntFlag(ocorrencias.historico_scr));
      request.input('historico_pagamentos_positivo', sql.Int, toIntFlag(ocorrencias.historico_pagamentos_positivo));
      request.input('limite_credito_pj', sql.Decimal(15, 2), ocorrencias.limite_credito_pj || null);
      request.input('quadro_administrativo', sql.Int, toIntFlag(ocorrencias.quadro_administrativo));
      request.input('consultas_realizadas', sql.Int, ocorrencias.consultas_realizadas || 0);
      request.input('gasto_financeiro_estimado', sql.Decimal(15, 2), ocorrencias.gasto_financeiro_estimado || null);
      request.input('controle_societario', sql.Int, toIntFlag(ocorrencias.controle_societario));

      // Verificar se já existe ocorrências para esta empresa
      const checkOcorrencias = await request.query(`
        SELECT TOP 1 id FROM ocorrencias WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkOcorrencias.recordset.length > 0) {
        // Atualizar ocorrências existentes
        const ocorrenciasId = checkOcorrencias.recordset[0].id;
        console.log(`📊 Ocorrências já existem (ID: ${ocorrenciasId}), atualizando...`);
        await request.query(`
          UPDATE ocorrencias 
          SET 
            score_pj = @score_pj,
            dados_contato = @dados_contato,
            historico_scr = @historico_scr,
            historico_pagamentos_positivo = @historico_pagamentos_positivo,
            limite_credito_pj = @limite_credito_pj,
            quadro_administrativo = @quadro_administrativo,
            consultas_realizadas = @consultas_realizadas,
            gasto_financeiro_estimado = @gasto_financeiro_estimado,
            controle_societario = @controle_societario,
            updated_at = GETDATE()
          WHERE id = ${ocorrenciasId}
        `);
        return ocorrenciasId;
      } else {
        // Inserir novas ocorrências
        const result = await request.query(`
          INSERT INTO ocorrencias (id_empresa, score_pj, dados_contato, historico_scr, historico_pagamentos_positivo, 
                                  limite_credito_pj, quadro_administrativo, consultas_realizadas, gasto_financeiro_estimado, controle_societario)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @score_pj, @dados_contato, @historico_scr, @historico_pagamentos_positivo, 
                  @limite_credito_pj, @quadro_administrativo, @consultas_realizadas, @gasto_financeiro_estimado, @controle_societario)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir ocorrências:', error);
      throw error;
    }
  }

  private async inserirSocioComRetry(socio: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('cpf', sql.VarChar(14), socio.cpf);
      request.input('nome', sql.VarChar(255), socio.nome);
      request.input('entrada', sql.Date, socio.entrada);
      request.input('participacao', sql.Decimal(15, 2), socio.participacao);
      request.input('valor_participacao', sql.Decimal(15, 2), socio.valor_participacao);
      request.input('percentual_participacao', sql.Decimal(5, 2), socio.percentual_participacao);
      request.input('cargo', sql.VarChar(100), socio.cargo);

      const result = await request.query(`
        INSERT INTO socios (id_empresa, cpf, nome, entrada, participacao, valor_participacao, percentual_participacao, cargo)
        OUTPUT INSERTED.id
        VALUES (@id_empresa, @cpf, @nome, @entrada, @participacao, @valor_participacao, @percentual_participacao, @cargo)
      `);

      return result.recordset[0].id;
    } catch (error) {
      console.error('❌ Erro ao inserir sócio:', error);
      throw error;
    }
  }

  private async inserirQuadroAdministrativoComRetry(quadro: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('cpf', sql.VarChar(14), quadro.cpf);
      request.input('nome', sql.VarChar(255), quadro.nome);
      request.input('cargo', sql.VarChar(100), quadro.cargo);
      request.input('eleito_em', sql.Date, quadro.eleito_em);

      const result = await request.query(`
        INSERT INTO quadro_administrativo (id_empresa, cpf, nome, cargo, eleito_em)
        OUTPUT INSERTED.id
        VALUES (@id_empresa, @cpf, @nome, @cargo, @eleito_em)
      `);

      return result.recordset[0].id;
    } catch (error) {
      console.error('❌ Erro ao inserir quadro administrativo:', error);
      throw error;
    }
  }

  private async inserirHistoricoPagamentoPositivoComRetry(historico: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de histórico para inserir
      if (!historico || Object.keys(historico).length === 0) {
        console.log('⚠️ Dados de histórico de pagamento vazios, pulando inserção');
        return null;
      }

      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('compromissos_ativos', sql.VarChar(255), historico.compromissos_ativos);
      request.input('contratos_ativos', sql.Int, historico.contratos_ativos);
      request.input('credores', sql.Int, historico.credores);
      request.input('parcelas_a_vencer_percentual', sql.Decimal(5, 2), historico.parcelas_a_vencer_percentual);
      request.input('parcelas_pagas_percentual', sql.Decimal(5, 2), historico.parcelas_pagas_percentual);
      request.input('parcelas_abertas_percentual', sql.Decimal(5, 2), historico.parcelas_abertas_percentual);
      request.input('contratos_pagos', sql.VarChar(255), historico.contratos_pagos);
      request.input('contratos_abertos', sql.VarChar(255), historico.contratos_abertos);
      request.input('uso_cheque_especial', sql.Bit, historico.uso_cheque_especial);

      // Verificar se já existe histórico para esta empresa
      const checkHistorico = await request.query(`
        SELECT TOP 1 id FROM historico_pagamento_positivo WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkHistorico.recordset.length > 0) {
        // Atualizar histórico existente
        const historicoId = checkHistorico.recordset[0].id;
        console.log(`💰 Histórico já existe (ID: ${historicoId}), atualizando...`);
        await request.query(`
          UPDATE historico_pagamento_positivo 
          SET 
            compromissos_ativos = @compromissos_ativos,
            contratos_ativos = @contratos_ativos,
            credores = @credores,
            parcelas_a_vencer_percentual = @parcelas_a_vencer_percentual,
            parcelas_pagas_percentual = @parcelas_pagas_percentual,
            parcelas_abertas_percentual = @parcelas_abertas_percentual,
            contratos_pagos = @contratos_pagos,
            contratos_abertos = @contratos_abertos,
            uso_cheque_especial = @uso_cheque_especial,
            updated_at = GETDATE()
          WHERE id = ${historicoId}
        `);
        return historicoId;
      } else {
        // Inserir novo histórico
        const result = await request.query(`
          INSERT INTO historico_pagamento_positivo (id_empresa, compromissos_ativos, contratos_ativos, credores, 
                                                   parcelas_a_vencer_percentual, parcelas_pagas_percentual, parcelas_abertas_percentual,
                                                   contratos_pagos, contratos_abertos, uso_cheque_especial)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @compromissos_ativos, @contratos_ativos, @credores, 
                  @parcelas_a_vencer_percentual, @parcelas_pagas_percentual, @parcelas_abertas_percentual,
                  @contratos_pagos, @contratos_abertos, @uso_cheque_especial)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir histórico de pagamento:', error);
      throw error;
    }
  }

  private async inserirScoreCreditoComRetry(score: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de score para inserir
      if (!score || Object.keys(score).length === 0) {
        console.log('⚠️ Dados de score de crédito vazios, pulando inserção');
        return null;
      }

      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('score', sql.Int, score.score);
      request.input('risco', sql.VarChar(50), score.risco);
      request.input('probabilidade_inadimplencia', sql.Decimal(5, 2), score.probabilidade_inadimplencia);
      request.input('limite_credito_valor', sql.Decimal(15, 2), score.limite_credito_valor);
      request.input('gasto_financeiro_estimado_valor', sql.Decimal(15, 2), score.gasto_financeiro_estimado_valor);

      // Verificar se já existe score para esta empresa
      const checkScore = await request.query(`
        SELECT TOP 1 id FROM score_credito WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkScore.recordset.length > 0) {
        // Atualizar score existente
        const scoreId = checkScore.recordset[0].id;
        console.log(`📈 Score já existe (ID: ${scoreId}), atualizando...`);
        await request.query(`
          UPDATE score_credito 
          SET 
            score = @score,
            risco = @risco,
            probabilidade_inadimplencia = @probabilidade_inadimplencia,
            limite_credito_valor = @limite_credito_valor,
            gasto_financeiro_estimado_valor = @gasto_financeiro_estimado_valor,
            updated_at = GETDATE()
          WHERE id = ${scoreId}
        `);
        return scoreId;
      } else {
        // Inserir novo score
        const result = await request.query(`
          INSERT INTO score_credito (id_empresa, score, risco, probabilidade_inadimplencia, limite_credito_valor, gasto_financeiro_estimado_valor)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @score, @risco, @probabilidade_inadimplencia, @limite_credito_valor, @gasto_financeiro_estimado_valor)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir score de crédito:', error);
      throw error;
    }
  }

  private async inserirSCRComRetry(scr: any, empresaId: number, transaction: sql.Transaction): Promise<number | null> {
    try {
      // Verifica se há dados de SCR para inserir
      if (!scr || Object.keys(scr).length === 0) {
        console.log('⚠️ Dados de SCR vazios, pulando inserção');
        return null;
      }

      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('atualizacao', sql.Date, scr.atualizacao);
      request.input('quantidade_operacoes', sql.Int, scr.quantidade_operacoes);
      request.input('inicio_relacionamento', sql.Date, scr.inicio_relacionamento);
      request.input('valor_contratado', sql.VarChar(255), scr.valor_contratado);
      request.input('instituicoes', sql.Int, scr.instituicoes);
      request.input('carteira_ativa_total', sql.VarChar(255), scr.carteira_ativa_total);
      request.input('vencimento_ultima_parcela', sql.VarChar(20), scr.vencimento_ultima_parcela);
      request.input('garantias_quantidade_maxima', sql.Int, scr.garantias_quantidade_maxima);

      // Verificar se já existe SCR para esta empresa
      const checkSCR = await request.query(`
        SELECT TOP 1 id FROM scr WHERE id_empresa = @id_empresa ORDER BY updated_at DESC, id DESC
      `);

      if (checkSCR.recordset.length > 0) {
        // Atualizar SCR existente
        const scrId = checkSCR.recordset[0].id;
        console.log(`🏦 SCR já existe (ID: ${scrId}), atualizando...`);
        await request.query(`
          UPDATE scr 
          SET 
            atualizacao = @atualizacao,
            quantidade_operacoes = @quantidade_operacoes,
            inicio_relacionamento = @inicio_relacionamento,
            valor_contratado = @valor_contratado,
            instituicoes = @instituicoes,
            carteira_ativa_total = @carteira_ativa_total,
            vencimento_ultima_parcela = @vencimento_ultima_parcela,
            garantias_quantidade_maxima = @garantias_quantidade_maxima,
            updated_at = GETDATE()
          WHERE id = ${scrId}
        `);
        return scrId;
      } else {
        // Inserir novo SCR
        const result = await request.query(`
          INSERT INTO scr (id_empresa, atualizacao, quantidade_operacoes, inicio_relacionamento, valor_contratado, 
                          instituicoes, carteira_ativa_total, vencimento_ultima_parcela, garantias_quantidade_maxima)
          OUTPUT INSERTED.id
          VALUES (@id_empresa, @atualizacao, @quantidade_operacoes, @inicio_relacionamento, @valor_contratado, 
                  @instituicoes, @carteira_ativa_total, @vencimento_ultima_parcela, @garantias_quantidade_maxima)
        `);
        return result.recordset[0].id;
      }
    } catch (error) {
      console.error('❌ Erro ao inserir SCR:', error);
      throw error;
    }
  }

  private async inserirConsultaRealizadaComRetry(consulta: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('id_empresa', sql.Int, empresaId);
      request.input('data_hora', sql.DateTime, consulta.data_hora);
      request.input('associado', sql.VarChar(255), consulta.associado);
      request.input('cidade', sql.VarChar(100), consulta.cidade);
      request.input('origem', sql.VarChar(255), consulta.origem);

      const result = await request.query(`
        INSERT INTO consultas_realizadas (id_empresa, data_hora, associado, cidade, origem)
        OUTPUT INSERTED.id
        VALUES (@id_empresa, @data_hora, @associado, @cidade, @origem)
      `);

      return result.recordset[0].id;
    } catch (error) {
      console.error('❌ Erro ao inserir consulta realizada:', error);
      throw error;
    }
  }

  private async inserirTipoGarantiaComRetry(tipoGarantia: any, scrId: number, transaction: sql.Transaction): Promise<number> {
    try {
      const request = new sql.Request(transaction);
      request.input('id_scr', sql.Int, scrId);
      request.input('tipo_garantia', sql.VarChar(100), tipoGarantia.tipo_garantia);

      const result = await request.query(`
        INSERT INTO tipos_garantias (id_scr, tipo_garantia)
        OUTPUT INSERTED.id
        VALUES (@id_scr, @tipo_garantia)
      `);

      return result.recordset[0].id;
    } catch (error) {
      console.error('❌ Erro ao inserir tipo de garantia:', error);
      throw error;
    }
  }
}
