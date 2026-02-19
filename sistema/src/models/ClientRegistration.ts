import * as sql from 'mssql';
import { getSqlConnection, executeSqlQuery, executeSqlTransaction } from '../config/sqlserver';

export interface ClientRegistration {
  id: number;
  user_id: number;
  nome_cliente: string;
  nome_fantasia?: string;
  cnpj: string;
  email: string;
  ramo_atividade_id: number;
  ramo_atividade_nome?: string;
  vendedor_id: number;
  vendedor_nome?: string;
  gestor_id: number;
  gestor_nome?: string;
  codigo_carteira_id: number;
  codigo_carteira_nome?: string;
  prazo_desejado?: number;
  periodicidade_pedido?: string;
  valor_estimado_pedido?: number;
  lista_preco_id: number;
  lista_preco_nome?: string;
  forma_contato?: string;
  imagem_externa_path: string;
  imagem_interna_path: string;
  anexos_path?: string;
  whatsapp_cliente?: string;
  rede_social?: string;
  link_google_maps?: string;
  forma_pagamento_desejada_id: number;
  forma_pagamento_desejada_nome?: string;
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
  // Campos do Atak
  atak_cliente_id?: number;
  atak_resposta_json?: string;
  atak_data_cadastro?: Date;
  atak_erro?: string;
  // Campos financeiros (definidos após análise)
  condicao_pagamento_id?: string;
  limite_credito?: number;
  dados_financeiros_enviados_atak?: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateClientRegistrationRequest {
  user_id: number;
  nome_cliente: string;
  nome_fantasia?: string;
  cnpj: string;
  email: string;
  ramo_atividade_id: number;
  vendedor_id: number;
  gestor_id: number;
  codigo_carteira_id: number;
  lista_preco_id: number;
  forma_pagamento_desejada_id: number;
  prazo_desejado?: number;
  periodicidade_pedido?: string;
  valor_estimado_pedido?: number;
  forma_contato?: string;
  imagem_externa_path: string;
  imagem_interna_path: string;
  anexos_path?: string;
  whatsapp_cliente?: string;
  rede_social?: string;
  link_google_maps?: string;
}

export interface UpdateClientRegistrationStatusRequest {
  status: 'cadastro_enviado' | 'aguardando_analise_credito' | 'cadastro_finalizado';
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
}

export interface UpdateClientRegistrationRequest extends Partial<CreateClientRegistrationRequest> {
  condicao_pagamento_id?: string;
  limite_credito?: number;
  dados_financeiros_enviados_atak?: boolean;
  imagem_externa_path?: string;
  imagem_interna_path?: string;
  anexos_path?: string;
}

export interface ClientRegistrationFilters {
  status?: string;
  user_id?: number;
  cnpj?: string;
  nome_cliente?: string;
  email?: string;
  page?: number;
  limit?: number;
}

export class ClientRegistrationModel {
  static async create(data: CreateClientRegistrationRequest): Promise<ClientRegistration> {
    console.log('💾 [CLIENT-REGISTRATION-MODEL] Iniciando criação de cadastro...');
    console.log('📝 [CLIENT-REGISTRATION-MODEL] Dados recebidos:', {
      nome_cliente: data.nome_cliente,
      cnpj: data.cnpj,
      email: data.email,
      user_id: data.user_id,
      ramo_atividade_id: data.ramo_atividade_id,
      vendedor_id: data.vendedor_id,
      gestor_id: data.gestor_id,
      codigo_carteira_id: data.codigo_carteira_id,
      lista_preco_id: data.lista_preco_id,
      forma_pagamento_desejada_id: data.forma_pagamento_desejada_id
    });

    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    console.log('🔧 [CLIENT-REGISTRATION-MODEL] Configurando parâmetros SQL...');
    
    request.input('user_id', sql.Int, data.user_id);
    request.input('nome_cliente', sql.NVarChar(255), data.nome_cliente);
    request.input('nome_fantasia', sql.NVarChar(255), data.nome_fantasia || null);
    // Garante CNPJ normalizado no banco para evitar duplicidade por formatação
    const cleanCnpj = (data.cnpj || '').replace(/\D/g, '');
    request.input('cnpj', sql.VarChar(18), cleanCnpj);
    request.input('email', sql.VarChar(255), data.email);
    request.input('ramo_atividade_id', sql.Int, data.ramo_atividade_id);
    request.input('vendedor_id', sql.Int, data.vendedor_id);
    request.input('gestor_id', sql.Int, data.gestor_id);
    request.input('codigo_carteira_id', sql.Int, data.codigo_carteira_id);
    request.input('lista_preco_id', sql.Int, data.lista_preco_id);
    request.input('forma_pagamento_desejada_id', sql.Int, data.forma_pagamento_desejada_id);
    request.input('prazo_desejado', sql.Int, data.prazo_desejado || null);
    request.input('periodicidade_pedido', sql.NVarChar(100), data.periodicidade_pedido || null);
    request.input('valor_estimado_pedido', sql.Decimal(15, 2), data.valor_estimado_pedido || null);
    request.input('forma_contato', sql.NVarChar(255), data.forma_contato || null);
    request.input('imagem_externa_path', sql.NVarChar(500), data.imagem_externa_path);
    request.input('imagem_interna_path', sql.NVarChar(500), data.imagem_interna_path);
    request.input('anexos_path', sql.NVarChar(sql.MAX), data.anexos_path || null);
    request.input('whatsapp_cliente', sql.VarChar(20), data.whatsapp_cliente || null);
    request.input('rede_social', sql.NVarChar(255), data.rede_social || null);
    request.input('link_google_maps', sql.NVarChar(500), data.link_google_maps || null);

    console.log('🚀 [CLIENT-REGISTRATION-MODEL] Executando query SQL...');

    const result = await request.query(`
      INSERT INTO client_registrations (
        user_id, nome_cliente, nome_fantasia, cnpj, email,
        ramo_atividade_id, vendedor_id, gestor_id, codigo_carteira_id,
        lista_preco_id, forma_pagamento_desejada_id, prazo_desejado,
        periodicidade_pedido, valor_estimado_pedido, forma_contato,
        imagem_externa_path, imagem_interna_path, anexos_path,
        whatsapp_cliente, rede_social, link_google_maps
      )
      OUTPUT INSERTED.*
      VALUES (
        @user_id, @nome_cliente, @nome_fantasia, @cnpj, @email,
        @ramo_atividade_id, @vendedor_id, @gestor_id, @codigo_carteira_id,
        @lista_preco_id, @forma_pagamento_desejada_id, @prazo_desejado,
        @periodicidade_pedido, @valor_estimado_pedido, @forma_contato,
        @imagem_externa_path, @imagem_interna_path, @anexos_path,
        @whatsapp_cliente, @rede_social, @link_google_maps
      )
    `);

    console.log('✅ [CLIENT-REGISTRATION-MODEL] Cadastro criado com sucesso no SQL Server:', {
      id: result.recordset[0].id,
      nome_cliente: result.recordset[0].nome_cliente,
      status: result.recordset[0].status
    });

    return this.mapToClientRegistration(result.recordset[0]);
  }

  static async update(id: number, data: UpdateClientRegistrationRequest): Promise<ClientRegistration | null> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);

    // Normaliza CNPJ se enviado
    const cleanCnpj = (data.cnpj || '').replace(/\D/g, '');

    request.input('id', sql.Int, id);
    request.input('nome_cliente', sql.NVarChar(255), data.nome_cliente || null);
    request.input('nome_fantasia', sql.NVarChar(255), data.nome_fantasia || null);
    request.input('cnpj', sql.VarChar(18), data.cnpj ? cleanCnpj : null);
    request.input('email', sql.VarChar(255), data.email || null);
    request.input('ramo_atividade_id', sql.Int, data.ramo_atividade_id || null);
    request.input('vendedor_id', sql.Int, data.vendedor_id || null);
    request.input('gestor_id', sql.Int, data.gestor_id || null);
    request.input('codigo_carteira_id', sql.Int, data.codigo_carteira_id || null);
    request.input('lista_preco_id', sql.Int, data.lista_preco_id || null);
    request.input('forma_pagamento_desejada_id', sql.Int, data.forma_pagamento_desejada_id || null);
    request.input('prazo_desejado', sql.Int, data.prazo_desejado || null);
    request.input('periodicidade_pedido', sql.NVarChar(100), data.periodicidade_pedido || null);
    request.input('valor_estimado_pedido', sql.Decimal(15,2), data.valor_estimado_pedido || null);
    request.input('forma_contato', sql.NVarChar(255), data.forma_contato || null);
    request.input('imagem_externa_path', sql.NVarChar(500), data.imagem_externa_path || null);
    request.input('imagem_interna_path', sql.NVarChar(500), data.imagem_interna_path || null);
    request.input('anexos_path', sql.NVarChar(sql.MAX), data.anexos_path || null);
    request.input('whatsapp_cliente', sql.VarChar(20), data.whatsapp_cliente || null);
    request.input('rede_social', sql.NVarChar(255), data.rede_social || null);
    request.input('link_google_maps', sql.NVarChar(500), data.link_google_maps || null);
    // Campos financeiros
    request.input('condicao_pagamento_id', sql.VarChar(50), data.condicao_pagamento_id || null);
    request.input('limite_credito', sql.Decimal(15,2), data.limite_credito || null);
    request.input('dados_financeiros_enviados_atak', sql.Bit, data.dados_financeiros_enviados_atak !== undefined ? data.dados_financeiros_enviados_atak : null);

    const result = await request.query(`
      UPDATE client_registrations SET
        nome_cliente = COALESCE(@nome_cliente, nome_cliente),
        nome_fantasia = COALESCE(@nome_fantasia, nome_fantasia),
        cnpj = COALESCE(@cnpj, cnpj),
        email = COALESCE(@email, email),
        ramo_atividade_id = COALESCE(@ramo_atividade_id, ramo_atividade_id),
        vendedor_id = COALESCE(@vendedor_id, vendedor_id),
        gestor_id = COALESCE(@gestor_id, gestor_id),
        codigo_carteira_id = COALESCE(@codigo_carteira_id, codigo_carteira_id),
        lista_preco_id = COALESCE(@lista_preco_id, lista_preco_id),
        forma_pagamento_desejada_id = COALESCE(@forma_pagamento_desejada_id, forma_pagamento_desejada_id),
        prazo_desejado = COALESCE(@prazo_desejado, prazo_desejado),
        periodicidade_pedido = COALESCE(@periodicidade_pedido, periodicidade_pedido),
        valor_estimado_pedido = COALESCE(@valor_estimado_pedido, valor_estimado_pedido),
        forma_contato = COALESCE(@forma_contato, forma_contato),
        imagem_externa_path = COALESCE(@imagem_externa_path, imagem_externa_path),
        imagem_interna_path = COALESCE(@imagem_interna_path, imagem_interna_path),
        anexos_path = COALESCE(@anexos_path, anexos_path),
        whatsapp_cliente = COALESCE(@whatsapp_cliente, whatsapp_cliente),
        rede_social = COALESCE(@rede_social, rede_social),
        link_google_maps = COALESCE(@link_google_maps, link_google_maps),
        condicao_pagamento_id = COALESCE(@condicao_pagamento_id, condicao_pagamento_id),
        limite_credito = COALESCE(@limite_credito, limite_credito),
        dados_financeiros_enviados_atak = COALESCE(@dados_financeiros_enviados_atak, dados_financeiros_enviados_atak),
        updated_at = GETDATE()
      WHERE id = @id;
      SELECT * FROM client_registrations WHERE id = @id;
    `);

    if (!result.recordset || result.recordset.length === 0) return null;
    return this.mapToClientRegistration(result.recordset[0]);
  }

  static async findById(id: number): Promise<ClientRegistration | null> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('id', sql.Int, id);
    
    const result = await request.query(`
      SELECT 
        cr.*,
        ra.nome as ramo_atividade_nome,
        v.nome as vendedor_nome,
        g.nome as gestor_nome,
        cc.nome as codigo_carteira_nome,
        lp.nome as lista_preco_nome,
        fp.nome as forma_pagamento_desejada_nome
      FROM client_registrations cr
      LEFT JOIN client_config_ramo_atividade ra ON cr.ramo_atividade_id = ra.id
      LEFT JOIN client_config_vendedor v ON cr.vendedor_id = v.id
      LEFT JOIN client_config_gestor g ON cr.gestor_id = g.id
      LEFT JOIN client_config_codigo_carteira cc ON cr.codigo_carteira_id = cc.id
      LEFT JOIN client_config_lista_preco lp ON cr.lista_preco_id = lp.id
      LEFT JOIN client_config_forma_pagamento_desejada fp ON cr.forma_pagamento_desejada_id = fp.id
      WHERE cr.id = @id
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToClientRegistration(result.recordset[0]);
  }

  static async findByCNPJ(cnpj: string): Promise<ClientRegistration | null> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    // Normalizar CNPJ (remover formatação) para comparar apenas números
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    request.input('cnpj', sql.VarChar(18), cleanCnpj);
    
    const result = await request.query(`
      SELECT TOP 1
        cr.*,
        ra.nome as ramo_atividade_nome,
        v.nome as vendedor_nome,
        g.nome as gestor_nome,
        cc.nome as codigo_carteira_nome,
        lp.nome as lista_preco_nome,
        fp.nome as forma_pagamento_desejada_nome
      FROM client_registrations cr
      LEFT JOIN client_config_ramo_atividade ra ON cr.ramo_atividade_id = ra.id
      LEFT JOIN client_config_vendedor v ON cr.vendedor_id = v.id
      LEFT JOIN client_config_gestor g ON cr.gestor_id = g.id
      LEFT JOIN client_config_codigo_carteira cc ON cr.codigo_carteira_id = cc.id
      LEFT JOIN client_config_lista_preco lp ON cr.lista_preco_id = lp.id
      LEFT JOIN client_config_forma_pagamento_desejada fp ON cr.forma_pagamento_desejada_id = fp.id
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(cr.cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = @cnpj
      ORDER BY cr.created_at DESC
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToClientRegistration(result.recordset[0]);
  }

  static async findAll(filters: ClientRegistrationFilters = {}): Promise<{
    data: ClientRegistration[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    console.log('🔍 [CLIENT-REGISTRATION-MODEL] Buscando cadastros com filtros:', filters);
    
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    // Construir WHERE clause dinamicamente
    const whereConditions: string[] = [];
    const params: Record<string, any> = {};

    if (filters.status) {
      whereConditions.push('cr.status = @status');
      params.status = filters.status;
    }
    if (filters.user_id) {
      whereConditions.push('cr.user_id = @user_id');
      params.user_id = filters.user_id;
    }
    if (filters.cnpj) {
      whereConditions.push('cr.cnpj LIKE @cnpj');
      params.cnpj = `%${filters.cnpj}%`;
    }
    if (filters.nome_cliente) {
      whereConditions.push('cr.nome_cliente LIKE @nome_cliente');
      params.nome_cliente = `%${filters.nome_cliente}%`;
    }
    if (filters.email) {
      whereConditions.push('cr.email LIKE @email');
      params.email = `%${filters.email}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    console.log('🔧 [CLIENT-REGISTRATION-MODEL] WHERE clause:', whereClause);
    console.log('📊 [CLIENT-REGISTRATION-MODEL] Parâmetros:', params);

    // Query para buscar dados
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    // Adicionar parâmetros
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);

    console.log('🚀 [CLIENT-REGISTRATION-MODEL] Executando query de busca...');

    const dataResult = await request.query(`
      SELECT 
        cr.*,
        ra.nome as ramo_atividade_nome,
        v.nome as vendedor_nome,
        g.nome as gestor_nome,
        cc.nome as codigo_carteira_nome,
        lp.nome as lista_preco_nome,
        fp.nome as forma_pagamento_desejada_nome
      FROM client_registrations cr
      LEFT JOIN client_config_ramo_atividade ra ON cr.ramo_atividade_id = ra.id
      LEFT JOIN client_config_vendedor v ON cr.vendedor_id = v.id
      LEFT JOIN client_config_gestor g ON cr.gestor_id = g.id
      LEFT JOIN client_config_codigo_carteira cc ON cr.codigo_carteira_id = cc.id
      LEFT JOIN client_config_lista_preco lp ON cr.lista_preco_id = lp.id
      LEFT JOIN client_config_forma_pagamento_desejada fp ON cr.forma_pagamento_desejada_id = fp.id
      ${whereClause}
      ORDER BY cr.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `);

    console.log('📊 [CLIENT-REGISTRATION-MODEL] Dados encontrados:', dataResult.recordset.length);

    // Query para contar total
    const countRequest = new sql.Request(pool);
    Object.entries(params).forEach(([key, value]) => {
      countRequest.input(key, value);
    });

    console.log('🔢 [CLIENT-REGISTRATION-MODEL] Contando total de registros...');

    const countResult = await countRequest.query(`
      SELECT COUNT(*) as total
      FROM client_registrations cr
      ${whereClause}
    `);

    const total = countResult.recordset[0].total;
    const total_pages = Math.ceil(total / limit);

    console.log('✅ [CLIENT-REGISTRATION-MODEL] Resultado da busca:', {
      encontrados: dataResult.recordset.length,
      total,
      page,
      limit,
      total_pages
    });

    return {
      data: dataResult.recordset.map(row => this.mapToClientRegistration(row)),
      total,
      page,
      limit,
      total_pages
    };
  }

  static async findByUser(userId: number, filters: Omit<ClientRegistrationFilters, 'user_id'> = {}): Promise<ClientRegistration[]> {
    const result = await this.findAll({ ...filters, user_id: userId });
    return result.data;
  }

  static async findByUserId(userId: number): Promise<ClientRegistration[]> {
    return this.findByUser(userId);
  }

  static async getStatistics(startDate?: string, endDate?: string): Promise<any> {
    console.log('📊 [CLIENT-REGISTRATION-MODEL] Buscando estatísticas...', { startDate, endDate });
    
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    // Construir filtro de data se fornecido
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = 'WHERE CAST(created_at AS DATE) >= @startDate AND CAST(created_at AS DATE) <= @endDate';
      request.input('startDate', sql.Date, startDate);
      request.input('endDate', sql.Date, endDate);
    } else if (startDate) {
      dateFilter = 'WHERE CAST(created_at AS DATE) >= @startDate';
      request.input('startDate', sql.Date, startDate);
    } else if (endDate) {
      dateFilter = 'WHERE CAST(created_at AS DATE) <= @endDate';
      request.input('endDate', sql.Date, endDate);
    }
    
    // Contagens por status
    const result = await request.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM client_registrations
      ${dateFilter}
      GROUP BY status
    `);
    
    const statusCounts: { [key: string]: number } = {};
    result.recordset.forEach(row => {
      statusCounts[row.status] = row.count;
    });
    
    // Total de cadastros
    const totalRequest = new sql.Request(pool);
    if (startDate) totalRequest.input('startDate', sql.Date, startDate);
    if (endDate) totalRequest.input('endDate', sql.Date, endDate);
    const totalResult = await totalRequest.query(`SELECT COUNT(*) as total FROM client_registrations ${dateFilter}`);
    const total = totalResult.recordset[0].total;
    
    // Cadastros enviados hoje (só se não houver filtro de data ou se o filtro incluir hoje)
    let todayCount = 0;
    if (!startDate && !endDate) {
      const todayResult = await request.query(`
        SELECT COUNT(*) as count
        FROM client_registrations
        WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
      `);
      todayCount = todayResult.recordset[0].count;
    } else {
      // Se houver filtro de data, calcular cadastros do último dia do período
      const todayRequest = new sql.Request(pool);
      if (startDate) todayRequest.input('startDate', sql.Date, startDate);
      if (endDate) todayRequest.input('endDate', sql.Date, endDate);
      const todayFilter = dateFilter ? `${dateFilter} AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)` : 'WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)';
      const todayResult = await todayRequest.query(`
        SELECT COUNT(*) as count
        FROM client_registrations
        ${todayFilter}
      `);
      todayCount = todayResult.recordset[0].count;
    }
    
    // Cadastros pendentes de análise de crédito
    const pendingRequest = new sql.Request(pool);
    if (startDate) pendingRequest.input('startDate', sql.Date, startDate);
    if (endDate) pendingRequest.input('endDate', sql.Date, endDate);
    const pendingFilter = dateFilter ? `${dateFilter} AND status = @status` : 'WHERE status = @status';
    pendingRequest.input('status', sql.VarChar, 'aguardando_analise_credito');
    const pendingAnalysisResult = await pendingRequest.query(`
      SELECT COUNT(*) as count
      FROM client_registrations
      ${pendingFilter}
    `);
    const pendingAnalysisCount = pendingAnalysisResult.recordset[0].count;
    
    // Cadastros enviados (aguardando resposta)
    const sentCount = statusCounts['cadastro_enviado'] || 0;
    
    // Cadastros em análise
    const inAnalysisCount = (statusCounts['analisando'] || 0) + (statusCounts['aguardando_analise_credito'] || 0);
    
    // Cadastros aprovados
    const approvedCount = statusCounts['cadastro_aprovado'] || 0;
    
    // Cadastros finalizados
    const completedCount = statusCounts['cadastro_finalizado'] || 0;
    
    console.log('✅ [CLIENT-REGISTRATION-MODEL] Estatísticas obtidas:', { 
      total, 
      statusCounts,
      todayCount,
      pendingAnalysisCount,
      startDate,
      endDate
    });
    
    return {
      totalRegistrations: total,
      statusCounts,
      todayCount,
      pendingAnalysisCount,
      sentCount,
      inAnalysisCount,
      approvedCount,
      completedCount
    };
  }

  static async getRecentHistory(): Promise<any[]> {
    console.log('📜 [CLIENT-REGISTRATION-MODEL] Buscando histórico recente...');
    
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    const result = await request.query(`
      SELECT TOP 10
        cr.id,
        cr.nome_cliente,
        cr.status,
        cr.created_at,
        cr.updated_at
      FROM client_registrations cr
      ORDER BY cr.created_at DESC
    `);
    
    console.log('✅ [CLIENT-REGISTRATION-MODEL] Histórico obtido:', result.recordset.length, 'registros');
    
    return result.recordset.map(row => ({
      id: row.id,
      nome_cliente: row.nome_cliente,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  static async updateStatus(
    id: number, 
    newStatus: string, 
    userId: number, 
    observacoes?: string,
    prazo_aprovado?: string,
    limite_aprovado?: string
  ): Promise<ClientRegistration> {
    return await executeSqlTransaction(async (transaction) => {
      // 1. Buscar status atual
      const currentRequest = new sql.Request(transaction);
      currentRequest.input('id', sql.Int, id);
      const currentResult = await currentRequest.query('SELECT status FROM client_registrations WHERE id = @id');
      
      if (currentResult.recordset.length === 0) {
        throw new Error('Cadastro não encontrado');
      }
      
      const currentStatus = currentResult.recordset[0].status;

      // 2. Atualizar status
      const updateRequest = new sql.Request(transaction);
      updateRequest.input('id', sql.Int, id);
      updateRequest.input('status', sql.VarChar(50), newStatus);
      
      await updateRequest.query('UPDATE client_registrations SET status = @status WHERE id = @id');

      // 3. Inserir no histórico
      const historyRequest = new sql.Request(transaction);
      historyRequest.input('registration_id', sql.Int, id);
      historyRequest.input('user_id', sql.Int, userId);
      historyRequest.input('status_anterior', sql.VarChar(50), currentStatus);
      historyRequest.input('status_novo', sql.VarChar(50), newStatus);
      historyRequest.input('observacoes', sql.NVarChar(sql.MAX), observacoes || null);
      historyRequest.input('prazo_aprovado', sql.NVarChar(50), prazo_aprovado || null);
      historyRequest.input('limite_aprovado', sql.NVarChar(50), limite_aprovado || null);

      await historyRequest.query(`
        INSERT INTO client_registration_history (
          registration_id, user_id, status_anterior, status_novo, 
          observacoes, prazo_aprovado, limite_aprovado
        )
        VALUES (
          @registration_id, @user_id, @status_anterior, @status_novo,
          @observacoes, @prazo_aprovado, @limite_aprovado
        )
      `);

      // 4. Retornar registro atualizado
      const updatedRequest = new sql.Request(transaction);
      updatedRequest.input('id', sql.Int, id);
      const updatedResult = await updatedRequest.query(`
        SELECT 
          cr.*,
          ra.nome as ramo_atividade_nome,
          v.nome as vendedor_nome,
          g.nome as gestor_nome,
          cc.nome as codigo_carteira_nome,
          lp.nome as lista_preco_nome,
          fp.nome as forma_pagamento_desejada_nome
        FROM client_registrations cr
        LEFT JOIN client_config_ramo_atividade ra ON cr.ramo_atividade_id = ra.id
        LEFT JOIN client_config_vendedor v ON cr.vendedor_id = v.id
        LEFT JOIN client_config_gestor g ON cr.gestor_id = g.id
        LEFT JOIN client_config_codigo_carteira cc ON cr.codigo_carteira_id = cc.id
        LEFT JOIN client_config_lista_preco lp ON cr.lista_preco_id = lp.id
        LEFT JOIN client_config_forma_pagamento_desejada fp ON cr.forma_pagamento_desejada_id = fp.id
        WHERE cr.id = @id
      `);

      return this.mapToClientRegistration(updatedResult.recordset[0]);
    });
  }

  static async count(filters: ClientRegistrationFilters = {}): Promise<number> {
    const whereConditions: string[] = [];
    const params: Record<string, any> = {};

    if (filters.status) {
      whereConditions.push('status = @status');
      params.status = filters.status;
    }
    if (filters.user_id) {
      whereConditions.push('user_id = @user_id');
      params.user_id = filters.user_id;
    }
    if (filters.cnpj) {
      whereConditions.push('cnpj LIKE @cnpj');
      params.cnpj = `%${filters.cnpj}%`;
    }
    if (filters.nome_cliente) {
      whereConditions.push('nome_cliente LIKE @nome_cliente');
      params.nome_cliente = `%${filters.nome_cliente}%`;
    }
    if (filters.email) {
      whereConditions.push('email LIKE @email');
      params.email = `%${filters.email}%`;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const result = await executeSqlQuery(`
      SELECT COUNT(*) as total
      FROM client_registrations
      ${whereClause}
    `, params);

    return result[0].total;
  }

  private static mapToClientRegistration(row: any): ClientRegistration {
    return {
      id: row.id,
      user_id: row.user_id,
      nome_cliente: row.nome_cliente,
      nome_fantasia: row.nome_fantasia,
      cnpj: row.cnpj,
      email: row.email,
      ramo_atividade_id: row.ramo_atividade_id,
      ramo_atividade_nome: row.ramo_atividade_nome,
      vendedor_id: row.vendedor_id,
      vendedor_nome: row.vendedor_nome,
      gestor_id: row.gestor_id,
      gestor_nome: row.gestor_nome,
      codigo_carteira_id: row.codigo_carteira_id,
      codigo_carteira_nome: row.codigo_carteira_nome,
      prazo_desejado: row.prazo_desejado,
      periodicidade_pedido: row.periodicidade_pedido,
      valor_estimado_pedido: row.valor_estimado_pedido,
      lista_preco_id: row.lista_preco_id,
      lista_preco_nome: row.lista_preco_nome,
      forma_contato: row.forma_contato,
      imagem_externa_path: row.imagem_externa_path,
      imagem_interna_path: row.imagem_interna_path,
      anexos_path: row.anexos_path,
      whatsapp_cliente: row.whatsapp_cliente,
      rede_social: row.rede_social,
      link_google_maps: row.link_google_maps,
      forma_pagamento_desejada_id: row.forma_pagamento_desejada_id,
      forma_pagamento_desejada_nome: row.forma_pagamento_desejada_nome,
      status: row.status,
      // Campos do Atak
      atak_cliente_id: row.atak_cliente_id,
      atak_resposta_json: row.atak_resposta_json,
      atak_data_cadastro: row.atak_data_cadastro ? new Date(row.atak_data_cadastro) : undefined,
      atak_erro: row.atak_erro,
      // Campos financeiros
      condicao_pagamento_id: row.condicao_pagamento_id,
      limite_credito: row.limite_credito,
      dados_financeiros_enviados_atak: row.dados_financeiros_enviados_atak || false,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at)
    };
  }
}
