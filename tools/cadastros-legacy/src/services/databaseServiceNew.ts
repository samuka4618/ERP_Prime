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

export class DatabaseServiceNew {
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
      
      console.log('✅ Conectado ao banco de dados SQL Server (Novo Schema)');
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
   * Insere dados completos de uma consulta TESS usando o novo schema
   */
  async inserirDadosTESSCompletos(dados: DadosTESSCompletos): Promise<{
    consultaId: number;
    empresaId: number;
    enderecoId: number;
    dadosContatoId: number;
    ocorrenciasId: number;
    sociosIds: number[];
    quadroIds: number[];
    historicoPagamentoId: number;
    scoreCreditoId: number;
    scrId: number;
    consultasRealizadasIds: number[];
    tiposGarantiasIds: number[];
  }> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    try {
      // 1. Inserir Consulta
      console.log('📝 Inserindo consulta...');
      const consultaId = await this.inserirConsulta(dados.consulta, transaction);
      console.log(`✅ Consulta inserida com ID: ${consultaId}`);

      // 2. Inserir Empresa
      console.log('🏢 Inserindo empresa...');
      const empresaId = await this.inserirEmpresa(dados.empresa, consultaId, transaction);
      console.log(`✅ Empresa inserida com ID: ${empresaId}`);

      // 3. Inserir Endereço
      console.log('📍 Inserindo endereço...');
      const enderecoId = await this.inserirEndereco(dados.endereco, empresaId, transaction);
      console.log(`✅ Endereço inserido com ID: ${enderecoId}`);

      // 4. Inserir Dados de Contato
      console.log('📞 Inserindo dados de contato...');
      const dadosContatoId = await this.inserirDadosContato(dados.dados_contato, empresaId, transaction);
      console.log(`✅ Dados de contato inseridos com ID: ${dadosContatoId}`);

      // 5. Inserir Ocorrências
      console.log('📊 Inserindo ocorrências...');
      const ocorrenciasId = await this.inserirOcorrencias(dados.ocorrencias, empresaId, transaction);
      console.log(`✅ Ocorrências inseridas com ID: ${ocorrenciasId}`);

      // 6. Inserir Sócios
      console.log('👥 Inserindo sócios...');
      const sociosIds: number[] = [];
      for (let i = 0; i < dados.socios.length; i++) {
        const socioId = await this.inserirSocio(dados.socios[i], empresaId, transaction);
        sociosIds.push(socioId);
        console.log(`✅ Sócio ${i + 1}/${dados.socios.length} inserido com ID: ${socioId}`);
      }

      // 7. Inserir Quadro Administrativo
      console.log('🏢 Inserindo quadro administrativo...');
      const quadroIds: number[] = [];
      for (let i = 0; i < dados.quadro_administrativo.length; i++) {
        const quadroId = await this.inserirQuadroAdministrativo(dados.quadro_administrativo[i], empresaId, transaction);
        quadroIds.push(quadroId);
        console.log(`✅ Quadro ${i + 1}/${dados.quadro_administrativo.length} inserido com ID: ${quadroId}`);
      }

      // 8. Inserir Histórico de Pagamento Positivo
      console.log('💰 Inserindo histórico de pagamento positivo...');
      const historicoPagamentoId = await this.inserirHistoricoPagamentoPositivo(dados.historico_pagamento_positivo, empresaId, transaction);
      console.log(`✅ Histórico de pagamento inserido com ID: ${historicoPagamentoId}`);

      // 9. Inserir Score de Crédito
      console.log('📈 Inserindo score de crédito...');
      const scoreCreditoId = await this.inserirScoreCredito(dados.score_credito, empresaId, transaction);
      console.log(`✅ Score de crédito inserido com ID: ${scoreCreditoId}`);

      // 10. Inserir SCR
      console.log('🏦 Inserindo dados SCR...');
      const scrId = await this.inserirSCR(dados.scr, empresaId, transaction);
      console.log(`✅ SCR inserido com ID: ${scrId}`);

      // 11. Inserir Consultas Realizadas
      console.log('🔍 Inserindo consultas realizadas...');
      const consultasRealizadasIds: number[] = [];
      for (let i = 0; i < dados.consultas_realizadas.length; i++) {
        const consultaRealizadaId = await this.inserirConsultaRealizada(dados.consultas_realizadas[i], empresaId, transaction);
        consultasRealizadasIds.push(consultaRealizadaId);
        console.log(`✅ Consulta realizada ${i + 1}/${dados.consultas_realizadas.length} inserida com ID: ${consultaRealizadaId}`);
      }

      // 12. Inserir Tipos de Garantias
      console.log('🛡️ Inserindo tipos de garantias...');
      const tiposGarantiasIds: number[] = [];
      for (let i = 0; i < dados.tipos_garantias.length; i++) {
        const tipoGarantiaId = await this.inserirTipoGarantia(dados.tipos_garantias[i], scrId, transaction);
        tiposGarantiasIds.push(tipoGarantiaId);
        console.log(`✅ Tipo de garantia ${i + 1}/${dados.tipos_garantias.length} inserido com ID: ${tipoGarantiaId}`);
      }

      await transaction.commit();

      console.log(`✅ Dados inseridos com sucesso no banco de dados (Novo Schema)`);
      console.log(`   - Consulta ID: ${consultaId}`);
      console.log(`   - Empresa ID: ${empresaId}`);
      console.log(`   - Sócios: ${sociosIds.length}`);
      console.log(`   - Quadro Administrativo: ${quadroIds.length}`);
      console.log(`   - Consultas Realizadas: ${consultasRealizadasIds.length}`);
      console.log(`   - Tipos de Garantias: ${tiposGarantiasIds.length}`);

      Logger.success('Dados TESS inseridos no banco de dados (Novo Schema)', {
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
      await transaction.rollback();
      console.error('❌ Erro ao inserir dados no banco:', error);
      Logger.error('Erro ao inserir dados TESS', { error: error instanceof Error ? error.message : 'Erro desconhecido' });
      throw error;
    }
  }

  // Métodos de inserção individuais

  private async inserirConsulta(consulta: any, transaction: sql.Transaction): Promise<number> {
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
  }

  private async inserirEmpresa(empresa: any, consultaId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('cnpj', sql.VarChar(18), empresa.cnpj);
    request.input('inscricao_estadual', sql.VarChar(50), empresa.inscricao_estadual);
    request.input('razao_social', sql.VarChar(500), empresa.razao_social);
    request.input('situacao_cnpj', sql.VarChar(50), empresa.situacao_cnpj);
    request.input('atualizacao', sql.DateTime, empresa.atualizacao);
    request.input('fundacao', sql.Date, empresa.fundacao);
    request.input('id_consulta', sql.Int, consultaId);

    const result = await request.query(`
      INSERT INTO empresa (cnpj, inscricao_estadual, razao_social, situacao_cnpj, atualizacao, fundacao, id_consulta)
      OUTPUT INSERTED.id
      VALUES (@cnpj, @inscricao_estadual, @razao_social, @situacao_cnpj, @atualizacao, @fundacao, @id_consulta)
    `);

    return result.recordset[0].id;
  }

  private async inserirEndereco(endereco: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('id_empresa', sql.Int, empresaId);
    request.input('logradouro', sql.VarChar(255), endereco.logradouro);
    request.input('numero', sql.VarChar(20), endereco.numero);
    request.input('complemento', sql.VarChar(255), endereco.complemento);
    request.input('bairro', sql.VarChar(100), endereco.bairro);
    request.input('cidade', sql.VarChar(100), endereco.cidade);
    request.input('estado', sql.VarChar(2), endereco.estado);
    request.input('cep', sql.VarChar(10), endereco.cep);
    request.input('longitude', sql.Decimal(10, 8), endereco.longitude);
    request.input('latitude', sql.Decimal(10, 8), endereco.latitude);

    const result = await request.query(`
      INSERT INTO endereco (id_empresa, logradouro, numero, complemento, bairro, cidade, estado, cep, longitude, latitude)
      OUTPUT INSERTED.id
      VALUES (@id_empresa, @logradouro, @numero, @complemento, @bairro, @cidade, @estado, @cep, @longitude, @latitude)
    `);

    return result.recordset[0].id;
  }

  private async inserirDadosContato(dadosContato: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('id_empresa', sql.Int, empresaId);
    request.input('telefones_fixos', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.telefones_fixos || []));
    request.input('telefones_celulares', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.telefones_celulares || []));
    request.input('emails', sql.NVarChar(sql.MAX), JSON.stringify(dadosContato.emails || []));

    const result = await request.query(`
      INSERT INTO dados_contato (id_empresa, telefones_fixos, telefones_celulares, emails)
      OUTPUT INSERTED.id
      VALUES (@id_empresa, @telefones_fixos, @telefones_celulares, @emails)
    `);

    return result.recordset[0].id;
  }

  private async inserirOcorrencias(ocorrencias: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('id_empresa', sql.Int, empresaId);
    request.input('score_pj', sql.Int, ocorrencias.score_pj);
    request.input('dados_contato', sql.Int, ocorrencias.dados_contato);
    request.input('historico_scr', sql.Int, ocorrencias.historico_scr);
    request.input('historico_pagamentos_positivo', sql.Int, ocorrencias.historico_pagamentos_positivo);
    request.input('limite_credito_pj', sql.Decimal(15, 2), ocorrencias.limite_credito_pj);
    request.input('quadro_administrativo', sql.Int, ocorrencias.quadro_administrativo);
    request.input('consultas_realizadas', sql.Int, ocorrencias.consultas_realizadas);
    request.input('gasto_financeiro_estimado', sql.Decimal(15, 2), ocorrencias.gasto_financeiro_estimado);
    request.input('controle_societario', sql.Int, ocorrencias.controle_societario);

    const result = await request.query(`
      INSERT INTO ocorrencias (id_empresa, score_pj, dados_contato, historico_scr, historico_pagamentos_positivo, 
                              limite_credito_pj, quadro_administrativo, consultas_realizadas, gasto_financeiro_estimado, controle_societario)
      OUTPUT INSERTED.id
      VALUES (@id_empresa, @score_pj, @dados_contato, @historico_scr, @historico_pagamentos_positivo, 
              @limite_credito_pj, @quadro_administrativo, @consultas_realizadas, @gasto_financeiro_estimado, @controle_societario)
    `);

    return result.recordset[0].id;
  }

  private async inserirSocio(socio: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
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
  }

  private async inserirQuadroAdministrativo(quadro: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
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
  }

  private async inserirHistoricoPagamentoPositivo(historico: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
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

  private async inserirScoreCredito(score: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('id_empresa', sql.Int, empresaId);
    request.input('score', sql.Int, score.score);
    request.input('risco', sql.VarChar(50), score.risco);
    request.input('probabilidade_inadimplencia', sql.Decimal(5, 2), score.probabilidade_inadimplencia);
    request.input('limite_credito_valor', sql.Decimal(15, 2), score.limite_credito_valor);
    request.input('gasto_financeiro_estimado_valor', sql.Decimal(15, 2), score.gasto_financeiro_estimado_valor);

    const result = await request.query(`
      INSERT INTO score_credito (id_empresa, score, risco, probabilidade_inadimplencia, limite_credito_valor, gasto_financeiro_estimado_valor)
      OUTPUT INSERTED.id
      VALUES (@id_empresa, @score, @risco, @probabilidade_inadimplencia, @limite_credito_valor, @gasto_financeiro_estimado_valor)
    `);

    return result.recordset[0].id;
  }

  private async inserirSCR(scr: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
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

    const result = await request.query(`
      INSERT INTO scr (id_empresa, atualizacao, quantidade_operacoes, inicio_relacionamento, valor_contratado, 
                      instituicoes, carteira_ativa_total, vencimento_ultima_parcela, garantias_quantidade_maxima)
      OUTPUT INSERTED.id
      VALUES (@id_empresa, @atualizacao, @quantidade_operacoes, @inicio_relacionamento, @valor_contratado, 
              @instituicoes, @carteira_ativa_total, @vencimento_ultima_parcela, @garantias_quantidade_maxima)
    `);

    return result.recordset[0].id;
  }

  private async inserirConsultaRealizada(consulta: any, empresaId: number, transaction: sql.Transaction): Promise<number> {
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
  }

  private async inserirTipoGarantia(tipoGarantia: any, scrId: number, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    request.input('id_scr', sql.Int, scrId);
    request.input('tipo_garantia', sql.VarChar(100), tipoGarantia.tipo_garantia);

    const result = await request.query(`
      INSERT INTO tipos_garantias (id_scr, tipo_garantia)
      OUTPUT INSERTED.id
      VALUES (@id_scr, @tipo_garantia)
    `);

    return result.recordset[0].id;
  }
}
