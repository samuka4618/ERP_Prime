import * as sql from 'mssql';
import { Logger } from '../utils/logger';

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

export interface ConsultaTESSData {
  cnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  situacaoCadastral?: string;
  dataConsulta: Date;
  arquivoPDF: string;
  respostaTESS?: string;
  creditosUtilizados?: number;
}

export interface EmpresaData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacaoCadastral?: string;
  porte?: string;
  naturezaJuridica?: string;
  dataAbertura?: Date;
  capitalSocial?: number;
  endereco?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  atividadePrincipal?: string;
  inscricaoEstadual?: string;
  inscricaoSuframa?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  cnpjaResponse?: string; // Resposta completa do CNPJÁ em JSON
}

export interface SocioData {
  cnpj: string;
  cpfCnpj: string;
  nome: string;
  tipoPessoa: 'F' | 'J';
  statusSocio?: string;
}

export interface ParticipacaoSocietariaData {
  cnpj: string;
  cpfCnpj: string;
  participacaoPercentual: number;
  cargo?: string;
  dataEntrada?: Date;
  dataSaida?: Date;
  statusParticipacao?: string;
}

export interface QuadroAdministrativoData {
  cnpj: string;
  cpfCnpj: string;
  cargo: string;
  dataEleicao?: Date;
  statusCargo?: string;
}

export class DatabaseService {
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
      
      console.log('✅ Conectado ao banco de dados SQL Server');
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
   * Insere dados completos de uma consulta TESS
   */
  async inserirDadosTESSCompletos(data: {
    consulta: ConsultaTESSData;
    empresa: EmpresaData;
    socios: SocioData[];
    participacoes: ParticipacaoSocietariaData[];
    quadroAdministrativo: QuadroAdministrativoData[];
  }): Promise<{
    consultaTESSId: number;
    empresaId: number;
    consultaEmpresaId: number;
    sociosIds: number[];
    participacoesIds: number[];
    quadroIds: number[];
  }> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    try {
      // 1. Inserir Consulta TESS
      console.log('📝 Inserindo consulta TESS...');
      let consultaTESSId: number;
      try {
        consultaTESSId = await this.inserirConsultaTESS(data.consulta, transaction);
        console.log(`✅ Consulta TESS inserida com ID: ${consultaTESSId}`);
      } catch (error) {
        console.error('❌ Erro ao inserir consulta TESS:', error);
        throw error;
      }
      
      // 2. Inserir/Atualizar Empresa
      console.log('🏢 Inserindo empresa...');
      let empresaId: number;
      try {
        empresaId = await this.inserirEmpresa(data.empresa, transaction);
        console.log(`✅ Empresa inserida com ID: ${empresaId}`);
      } catch (error) {
        console.error('❌ Erro ao inserir empresa:', error);
        throw error;
      }
      
      // 3. Inserir Consulta Empresa
      console.log('🔗 Inserindo consulta empresa...');
      let consultaEmpresaId: number;
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
      } catch (error) {
        console.error('❌ Erro ao inserir consulta empresa:', error);
        throw error;
      }

      // 4. Inserir Sócios
      console.log('👥 Inserindo sócios...');
      const sociosIds: number[] = [];
      for (let i = 0; i < data.socios.length; i++) {
        try {
          const socioId = await this.inserirSocio(data.socios[i], empresaId, transaction);
          sociosIds.push(socioId);
          console.log(`✅ Sócio ${i + 1}/${data.socios.length} inserido com ID: ${socioId}`);
        } catch (error) {
          console.error(`❌ Erro ao inserir sócio ${i + 1}:`, error);
          throw error;
        }
      }

      // 5. Inserir Participações Societárias
      console.log('📊 Inserindo participações societárias...');
      const participacoesIds: number[] = [];
      for (let i = 0; i < data.participacoes.length; i++) {
        try {
          const participacao = data.participacoes[i];
          const socioId = sociosIds[i] || sociosIds[0]; // Associa com o sócio correspondente
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
        } catch (error) {
          console.error(`❌ Erro ao inserir participação ${i + 1}:`, error);
          throw error;
        }
      }

      // 6. Inserir Quadro Administrativo
      console.log('🏢 Inserindo quadro administrativo...');
      const quadroIds: number[] = [];
      for (let i = 0; i < data.quadroAdministrativo.length; i++) {
        try {
          const quadro = data.quadroAdministrativo[i];
          const socioId = sociosIds[i] || sociosIds[0]; // Associa com o sócio correspondente
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
        } catch (error) {
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

      Logger.success('Dados TESS inseridos no banco de dados', {
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

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erro ao inserir dados no banco:', error);
      
      // Log detalhado do erro
      if (error instanceof Error) {
        console.error('❌ Mensagem do erro:', error.message);
        console.error('❌ Stack trace:', error.stack);
        
        // Se for erro de SQL Server, mostrar detalhes específicos
        if ('code' in error) {
          console.error('❌ Código do erro:', (error as any).code);
          console.error('❌ Número do erro:', (error as any).number);
          console.error('❌ Estado do erro:', (error as any).state);
          console.error('❌ Classe do erro:', (error as any).class);
          console.error('❌ Server name:', (error as any).serverName);
          console.error('❌ Procedure name:', (error as any).procName);
        }
        
        // Se for erro de transação, mostrar mais detalhes
        if (error.message.includes('Transaction has been aborted')) {
          console.error('❌ ERRO DE TRANSAÇÃO: Uma stored procedure falhou e abortou a transação');
          console.error('❌ Verifique os logs anteriores para identificar qual procedure falhou');
        }
      }
      
      Logger.error('Erro ao inserir dados TESS no banco', { 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Insere consulta TESS
   */
  private async inserirConsultaTESS(data: ConsultaTESSData, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    
    // Gerar FileID único baseado no timestamp e CNPJ
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

  /**
   * Insere empresa
   */
  private async inserirEmpresa(data: EmpresaData, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    
    request.input('CNPJ', sql.VarChar(18), data.cnpj);
    request.input('RazaoSocial', sql.VarChar(255), data.razaoSocial || '');
    request.input('NomeFantasia', sql.VarChar(255), data.nomeFantasia || null);
    request.input('SituacaoCNPJ', sql.VarChar(50), data.situacaoCadastral || 'ATIVA');
    request.input('DataFundacao', sql.Date, data.dataAbertura || null);
    request.input('PorteEmpresa', sql.VarChar(20), data.porte || null);
    
    // Extrair componentes do endereço se disponível
    let logradouro = data.endereco || null;
    let numero = null;
    let complemento = null;
    let bairro = null;
    
    if (data.endereco) {
      // Tentar extrair número e complemento do endereço
      const enderecoParts = data.endereco.split(/\s+/);
      if (enderecoParts.length > 1) {
        // Procurar por um número no endereço
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
    // Formatar telefones e emails como JSON para atender constraints do banco
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

  /**
   * Insere consulta empresa
   */
  private async inserirConsultaEmpresa(data: {
    consultaTESSId: number;
    empresaId: number;
    dataConsulta: Date;
    arquivoPDF: string;
    respostaTESS?: string;
    creditosUtilizados?: number;
  }, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    
    // Usar os parâmetros corretos da stored procedure atualizada
    request.input('ConsultaTESSId', sql.Int, data.consultaTESSId);
    request.input('EmpresaId', sql.Int, data.empresaId);
    request.input('DataConsulta', sql.DateTime2(3), data.dataConsulta);
    request.input('ArquivoPDF', sql.VarChar(255), data.arquivoPDF);
    request.input('RespostaTESS', sql.NVarChar(sql.MAX), data.respostaTESS || null);
    request.input('CreditosUtilizados', sql.Decimal(10,6), data.creditosUtilizados || 0);

    const result = await request.execute('sp_InserirConsultaEmpresa');
    return result.recordset[0].ConsultaEmpresaID;
  }

  /**
   * Insere dados de empresa com informações do CNPJÁ
   */
  async insertCompanyData(data: {
    cnpj: string;
    data_consulta: Date;
    spc_sucesso: boolean;
    spc_arquivo?: string;
    spc_erro?: string;
    tess_sucesso: boolean;
    tess_resposta?: string;
    tess_erro?: string;
    cnpja_sucesso: boolean;
    cnpja_erro?: string;
    inscricao_estadual?: string;
    latitude?: number;
    longitude?: number;
    endereco_completo?: string;
    atividade_principal?: string;
    porte?: string;
    telefone?: string;
    email?: string;
    website?: string;
    razao_social?: string;
    nome_fantasia?: string;
    situacao?: string;
    data_abertura?: string;
    natureza_juridica?: string;
    capital_social?: number;
  }): Promise<{ success: boolean; error?: string; empresaId?: number }> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const transaction = new sql.Transaction(this.pool);

    try {
      await transaction.begin();
      console.log('Iniciando inserção de dados da empresa no banco...');

      // 1. Inserir na tabela consulta
      const consultaId = await this.inserirConsulta(data, transaction);

      // 2. Inserir na tabela empresa
      const empresaId = await this.inserirEmpresaCompleta(data, consultaId, transaction);

      // 3. Inserir endereço se tiver coordenadas
      if (data.latitude && data.longitude) {
        await this.inserirEnderecoCompleto(data, empresaId, transaction);
      }

      // 4. Inserir dados de contato se disponíveis
      if (data.telefone || data.email) {
        await this.inserirDadosContatoCompleto(data, empresaId, transaction);
      }

      await transaction.commit();
      console.log(`✅ Dados da empresa ${data.cnpj} inseridos com sucesso. ID: ${empresaId}`);

      return { success: true, empresaId };

    } catch (error) {
      await transaction.rollback();
      console.error('Erro ao inserir dados da empresa:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    } finally {
      // Não fechar o pool aqui, pois pode ser usado por outras operações
      // O pool será fechado quando a instância for destruída
    }
  }

  /**
   * Insere consulta básica
   */
  private async inserirConsulta(data: any, transaction: sql.Transaction): Promise<number> {
    const request = new sql.Request(transaction);
    
    request.input('Operador', sql.VarChar(255), 'SISTEMA_INTEGRADO');
    request.input('DataHora', sql.DateTime2(3), data.data_consulta);
    request.input('Produto', sql.VarChar(255), 'SPC_TESS_CNPJA_INTEGRADO');
    request.input('Protocolo', sql.VarChar(50), `INT_${Date.now()}`);

    const result = await request.execute('sp_InserirConsulta');
    return result.recordset[0].ConsultaID;
  }

  /**
   * Insere empresa com dados completos
   */
  private async inserirEmpresaCompleta(data: any, consultaId: number, transaction: sql.Transaction): Promise<number> {
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

  /**
   * Insere endereço com coordenadas
   */
  private async inserirEnderecoCompleto(data: any, empresaId: number, transaction: sql.Transaction): Promise<void> {
    const request = new sql.Request(transaction);
    
    // Extrai componentes do endereço completo
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

  /**
   * Insere dados de contato
   */
  private async inserirDadosContatoCompleto(data: any, empresaId: number, transaction: sql.Transaction): Promise<void> {
    const request = new sql.Request(transaction);
    
    let telefonesFixosJSON = null;
    let telefonesCelularesJSON = null;
    let emailsJSON = null;
    
    if (data.telefone) {
      const telefones = data.telefone.split(/[,;]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      if (telefones.length > 0) {
        telefonesFixosJSON = JSON.stringify(telefones);
      }
    }
    
    if (data.email) {
      const emails = data.email.split(/[,;]/).map((e: string) => e.trim()).filter((e: string) => e.length > 0);
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

  /**
   * Insere sócio
   */
  private async inserirSocio(data: SocioData, empresaId: number, transaction: sql.Transaction): Promise<number> {
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

  /**
   * Insere participação societária
   */
  private async inserirParticipacaoSocietaria(data: {
    socioId: number;
    empresaId: number;
    consultaEmpresaId: number;
    participacaoPercentual: number;
    cargo?: string;
    dataEntrada?: Date;
    dataSaida?: Date;
    statusParticipacao?: string;
  }, transaction: sql.Transaction): Promise<number> {
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

  /**
   * Insere quadro administrativo
   */
  private async inserirQuadroAdministrativo(data: {
    socioId: number;
    empresaId: number;
    consultaEmpresaId: number;
    cargo: string;
    dataEleicao?: Date;
    statusCargo?: string;
  }, transaction: sql.Transaction): Promise<number> {
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

  /**
   * Busca dados consolidados de uma empresa
   */
  async buscarDadosConsolidados(cnpj: string): Promise<any> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const request = new sql.Request(this.pool);
    request.input('cnpj', sql.VarChar(18), cnpj);

    const result = await request.execute('sp_BuscarDadosConsolidados');
    return result.recordset;
  }

  /**
   * Lista empresas para análise
   */
  async listarEmpresasParaAnalise(): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const request = new sql.Request(this.pool);
    const result = await request.execute('sp_ListarEmpresasParaAnalise');
    return result.recordset;
  }

  /**
   * Testa a conexão com o banco
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = new sql.Request(this.pool!);
      const result = await request.query('SELECT 1 as test');
      
      console.log('✅ Teste de conexão com banco de dados: OK');
      return true;
    } catch (error) {
      console.error('❌ Teste de conexão com banco de dados: FALHA', error);
      return false;
    }
  }

  /**
   * Executa uma query SQL e retorna os resultados
   */
  async query(sqlQuery: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Não conectado ao banco de dados');
    }

    const request = new sql.Request(this.pool);
    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Testa se as stored procedures existem
   */
  async testStoredProcedures(): Promise<boolean> {
    try {
      if (!this.pool) {
        await this.connect();
      }

      const request = new sql.Request(this.pool!);
      
      // Verificar se as procedures existem
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
        } else {
          console.log(`✅ Stored procedure '${procName}' encontrada`);
        }
      }

      console.log('✅ Todas as stored procedures estão disponíveis');
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar stored procedures:', error);
      return false;
    }
  }
}
