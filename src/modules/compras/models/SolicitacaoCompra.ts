import { dbRun, dbGet, dbAll, db } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface SolicitacaoCompraItem {
  id?: number;
  item_numero: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  observacoes?: string;
}

export interface SolicitacaoCompra {
  id: number;
  numero_solicitacao: string;
  solicitante_id: number;
  comprador_id?: number;
  centro_custo?: string;
  descricao: string;
  justificativa?: string;
  status: 'rascunho' | 'pendente_aprovacao' | 'aprovada' | 'rejeitada' | 'em_cotacao' | 'cotacao_recebida' | 'orcamento_aprovado' | 'orcamento_rejeitado' | 'em_compra' | 'comprada' | 'cancelada' | 'devolvida';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  valor_total: number;
  data_necessidade?: Date | string;
  observacoes?: string;
  created_at: Date | string;
  updated_at: Date | string;
  aprovada_em?: Date | string;
  rejeitada_em?: Date | string;
  itens?: SolicitacaoCompraItem[];
  solicitante?: {
    id: number;
    name: string;
    email: string;
  };
  comprador?: {
    id: number;
    name: string;
    email: string;
  };
  comprador_user_id?: number;
}

export interface CreateSolicitacaoCompraRequest {
  centro_custo?: string;
  descricao: string;
  justificativa?: string;
  prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
  data_necessidade?: string;
  observacoes?: string;
  aprovadores_ids?: number[];
  itens: Omit<SolicitacaoCompraItem, 'id'>[];
}

export interface UpdateSolicitacaoCompraRequest {
  centro_custo?: string;
  descricao?: string;
  justificativa?: string;
  prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
  data_necessidade?: string;
  observacoes?: string;
  comprador_id?: number;
  itens?: Omit<SolicitacaoCompraItem, 'id'>[];
}

export class SolicitacaoCompraModel {
  private static gerarNumeroSolicitacao(): string {
    const ano = new Date().getFullYear();
    // Buscar último número do ano
    return `SC-${ano}-001`; // Simplificado, pode ser melhorado
  }

  static async create(userId: number, data: CreateSolicitacaoCompraRequest): Promise<SolicitacaoCompra> {
    // Calcular valor total
    const valorTotal = data.itens.reduce((sum, item) => {
      return sum + (item.quantidade * item.valor_unitario);
    }, 0);

    // Gerar número da solicitação
    const numeroSolicitacao = await this.gerarNumeroSolicitacaoUnico();

    // Formatar data_necessidade para SQLite (ISO string ou null) — Joi pode retornar Date
    const rawData = data.data_necessidade;
    const dataNecessidade = rawData == null || rawData === ''
      ? null
      : ((rawData as unknown) instanceof Date
          ? (rawData as unknown as Date).toISOString().split('T')[0]
          : String(rawData));

    // Valores explícitos para evitar undefined e tipos incompatíveis
    const insertParams = [
      numeroSolicitacao,
      userId,
      data.centro_custo ?? null,
      data.descricao,
      data.justificativa ?? null,
      data.prioridade ?? 'normal',
      valorTotal,
      dataNecessidade,
      (data.observacoes == null || data.observacoes === '') ? null : data.observacoes,
      'rascunho'
    ];

    const { lastID } = await dbRun(
      `INSERT INTO solicitacoes_compra 
       (numero_solicitacao, solicitante_id, centro_custo, descricao, justificativa, prioridade, valor_total, data_necessidade, observacoes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertParams
    );

    const solicitacaoId = Number(lastID);
    if (!solicitacaoId || Number.isNaN(solicitacaoId)) {
      throw new Error('Falha ao obter ID da solicitação criada');
    }

    // Inserir itens
    for (let i = 0; i < data.itens.length; i++) {
      const item = data.itens[i];
      const itemObs = (item.observacoes == null || item.observacoes === '') ? null : item.observacoes;
      await dbRun(
        `INSERT INTO solicitacoes_compra_itens 
         (solicitacao_id, item_numero, descricao, quantidade, unidade_medida, valor_unitario, valor_total, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          solicitacaoId,
          i + 1,
          item.descricao,
          item.quantidade,
          item.unidade_medida || 'UN',
          item.valor_unitario,
          item.quantidade * item.valor_unitario,
          itemObs
        ]
      );
    }

    // Criar histórico
    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'criado', 'Solicitação de compra criada')`,
      [solicitacaoId, userId]
    );

    // Se aprovadores foram especificados, criar registros de aprovação
    if (data.aprovadores_ids && data.aprovadores_ids.length > 0) {
      const aprovadoresIds = data.aprovadores_ids.map((id) => Number(id));
      const placeholders = aprovadoresIds.map(() => '?').join(',');
      const aprovadores = await dbAll(
        `SELECT id, user_id, nivel_aprovacao FROM aprovadores WHERE user_id IN (${placeholders}) AND is_active = 1`,
        aprovadoresIds
      ) as any[];

      for (const aprovador of aprovadores) {
        await dbRun(
          `INSERT INTO aprovacoes_solicitacao (solicitacao_id, aprovador_id, nivel_aprovacao, status)
           VALUES (?, ?, ?, 'pendente')`,
          [solicitacaoId, aprovador.id, aprovador.nivel_aprovacao || 1]
        );
      }

      const aprovadoresNaoEncontrados = aprovadoresIds.filter(
        (uid) => !aprovadores.some((a) => Number(a.user_id) === uid)
      );

      for (const uid of aprovadoresNaoEncontrados) {
        let aprovadorRow = await dbGet(
          'SELECT id FROM aprovadores WHERE user_id = ?',
          [uid]
        ) as { id: number } | undefined;

        if (!aprovadorRow) {
          await dbRun(
            `INSERT INTO aprovadores (user_id, nivel_aprovacao, valor_minimo, valor_maximo)
             VALUES (?, 1, 0, 999999999.99)`,
            [uid]
          );
          aprovadorRow = await dbGet(
            'SELECT id FROM aprovadores WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [uid]
          ) as { id: number };
        }

        if (aprovadorRow?.id) {
          await dbRun(
            `INSERT INTO aprovacoes_solicitacao (solicitacao_id, aprovador_id, nivel_aprovacao, status)
             VALUES (?, ?, 1, 'pendente')`,
            [solicitacaoId, aprovadorRow.id, 1]
          );
        }
      }
    }

    const result = await this.findById(solicitacaoId);
    if (!result) {
      throw new Error('Erro ao buscar solicitação criada');
    }
    return result;
  }

  private static async gerarNumeroSolicitacaoUnico(): Promise<string> {
    const ano = new Date().getFullYear();
    const prefixo = `SC-${ano}-`;
    
    // Buscar último número do ano
    const ultimo = await dbGet(
      `SELECT numero_solicitacao FROM solicitacoes_compra 
       WHERE numero_solicitacao LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefixo}%`]
    ) as any;

    if (ultimo) {
      const ultimoNumero = parseInt(ultimo.numero_solicitacao.split('-')[2]);
      const novoNumero = (ultimoNumero + 1).toString().padStart(3, '0');
      return `${prefixo}${novoNumero}`;
    }

    return `${prefixo}001`;
  }

  static async findById(id: number): Promise<SolicitacaoCompra | null> {
    const solicitacao = await dbGet(
      `SELECT s.*, 
              u.name as solicitante_name, u.email as solicitante_email,
              c.user_id as comprador_user_id, u2.name as comprador_name, u2.email as comprador_email
       FROM solicitacoes_compra s
       LEFT JOIN users u ON s.solicitante_id = u.id
       LEFT JOIN compradores c ON s.comprador_id = c.id
       LEFT JOIN users u2 ON c.user_id = u2.id
       WHERE s.id = ?`,
      [id]
    ) as any;

    if (!solicitacao) return null;

    // Buscar itens
    const itens = await dbAll(
      `SELECT * FROM solicitacoes_compra_itens 
       WHERE solicitacao_id = ? 
       ORDER BY item_numero`,
      [id]
    ) as any[];

    return {
      id: solicitacao.id,
      numero_solicitacao: solicitacao.numero_solicitacao,
      solicitante_id: solicitacao.solicitante_id,
      comprador_id: solicitacao.comprador_id,
      centro_custo: solicitacao.centro_custo,
      descricao: solicitacao.descricao,
      justificativa: solicitacao.justificativa,
      status: solicitacao.status,
      prioridade: solicitacao.prioridade,
      valor_total: parseFloat(solicitacao.valor_total),
      data_necessidade: solicitacao.data_necessidade ? await formatSystemDate(solicitacao.data_necessidade) : undefined,
      observacoes: solicitacao.observacoes,
      created_at: await formatSystemDate(solicitacao.created_at),
      updated_at: await formatSystemDate(solicitacao.updated_at),
      aprovada_em: solicitacao.aprovada_em ? await formatSystemDate(solicitacao.aprovada_em) : undefined,
      rejeitada_em: solicitacao.rejeitada_em ? await formatSystemDate(solicitacao.rejeitada_em) : undefined,
      itens: itens.map(item => ({
        id: item.id,
        item_numero: item.item_numero,
        descricao: item.descricao,
        quantidade: parseFloat(item.quantidade),
        unidade_medida: item.unidade_medida,
        valor_unitario: parseFloat(item.valor_unitario),
        valor_total: parseFloat(item.valor_total),
        observacoes: item.observacoes
      })),
      solicitante: {
        id: solicitacao.solicitante_id,
        name: solicitacao.solicitante_name,
        email: solicitacao.solicitante_email
      },
      comprador: solicitacao.comprador_user_id ? {
        id: solicitacao.comprador_user_id,
        name: solicitacao.comprador_name,
        email: solicitacao.comprador_email
      } : undefined,
      comprador_user_id: solicitacao.comprador_user_id || undefined
    };
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    solicitante_id?: number;
    comprador_id?: number;
    search?: string;
  }): Promise<{
    data: SolicitacaoCompra[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.status) {
      whereClause += ' AND s.status = ?';
      queryParams.push(params.status);
    }

    if (params.solicitante_id) {
      whereClause += ' AND s.solicitante_id = ?';
      queryParams.push(params.solicitante_id);
    }

    if (params.comprador_id) {
      whereClause += ' AND s.comprador_id = ?';
      queryParams.push(params.comprador_id);
    }

    if (params.search) {
      whereClause += ' AND (s.numero_solicitacao LIKE ? OR s.descricao LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const solicitacoes = await dbAll(
      `SELECT s.*, 
              u.name as solicitante_name, u.email as solicitante_email,
              c.user_id as comprador_user_id, u2.name as comprador_name, u2.email as comprador_email
       FROM solicitacoes_compra s
       LEFT JOIN users u ON s.solicitante_id = u.id
       LEFT JOIN compradores c ON s.comprador_id = c.id
       LEFT JOIN users u2 ON c.user_id = u2.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      solicitacoes.map(async (s) => {
        const itens = await dbAll(
          'SELECT * FROM solicitacoes_compra_itens WHERE solicitacao_id = ? ORDER BY item_numero',
          [s.id]
        ) as any[];

        return {
          id: s.id,
          numero_solicitacao: s.numero_solicitacao,
          solicitante_id: s.solicitante_id,
          comprador_id: s.comprador_id,
          centro_custo: s.centro_custo,
          descricao: s.descricao,
          justificativa: s.justificativa,
          status: s.status,
          prioridade: s.prioridade,
          valor_total: parseFloat(s.valor_total),
          data_necessidade: s.data_necessidade ? await formatSystemDate(s.data_necessidade) : undefined,
          observacoes: s.observacoes,
          created_at: await formatSystemDate(s.created_at),
          updated_at: await formatSystemDate(s.updated_at),
          aprovada_em: s.aprovada_em ? await formatSystemDate(s.aprovada_em) : undefined,
          rejeitada_em: s.rejeitada_em ? await formatSystemDate(s.rejeitada_em) : undefined,
          itens: itens.map(item => ({
            id: item.id,
            item_numero: item.item_numero,
            descricao: item.descricao,
            quantidade: parseFloat(item.quantidade),
            unidade_medida: item.unidade_medida,
            valor_unitario: parseFloat(item.valor_unitario),
            valor_total: parseFloat(item.valor_total),
            observacoes: item.observacoes
          })),
          solicitante: {
            id: s.solicitante_id,
            name: s.solicitante_name,
            email: s.solicitante_email
          },
          comprador: s.comprador_user_id ? {
            id: s.comprador_user_id,
            name: s.comprador_name,
            email: s.comprador_email
          } : undefined,
          comprador_user_id: s.comprador_user_id || undefined
        };
      })
    );

    return {
      data,
      total: totalResult.count,
      page,
      limit,
      total_pages: Math.ceil(totalResult.count / limit)
    };
  }

  static async update(id: number, data: UpdateSolicitacaoCompraRequest): Promise<SolicitacaoCompra | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.centro_custo !== undefined) {
      fields.push('centro_custo = ?');
      values.push(data.centro_custo);
    }
    if (data.descricao) {
      fields.push('descricao = ?');
      values.push(data.descricao);
    }
    if (data.justificativa !== undefined) {
      fields.push('justificativa = ?');
      values.push(data.justificativa);
    }
    if (data.prioridade) {
      fields.push('prioridade = ?');
      values.push(data.prioridade);
    }
    if (data.data_necessidade !== undefined) {
      fields.push('data_necessidade = ?');
      values.push(data.data_necessidade || null);
    }
    if (data.observacoes !== undefined) {
      fields.push('observacoes = ?');
      values.push(data.observacoes);
    }
    if (data.comprador_id !== undefined) {
      fields.push('comprador_id = ?');
      values.push(data.comprador_id || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE solicitacoes_compra SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    // Atualizar itens se fornecidos
    if (data.itens) {
      // Remover itens antigos
      await dbRun('DELETE FROM solicitacoes_compra_itens WHERE solicitacao_id = ?', [id]);

      // Inserir novos itens
      for (let i = 0; i < data.itens.length; i++) {
        const item = data.itens[i];
        await dbRun(
          `INSERT INTO solicitacoes_compra_itens 
           (solicitacao_id, item_numero, descricao, quantidade, unidade_medida, valor_unitario, valor_total, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            i + 1,
            item.descricao,
            item.quantidade,
            item.unidade_medida || 'UN',
            item.valor_unitario,
            item.quantidade * item.valor_unitario,
            item.observacoes || null
          ]
        );
      }

      // Recalcular valor total
      const itens = await dbAll(
        'SELECT * FROM solicitacoes_compra_itens WHERE solicitacao_id = ?',
        [id]
      ) as any[];

      const valorTotal = itens.reduce((sum, item) => sum + parseFloat(item.valor_total), 0);
      await dbRun('UPDATE solicitacoes_compra SET valor_total = ? WHERE id = ?', [valorTotal, id]);
    }

    return this.findById(id);
  }

  static async enviarParaAprovacao(id: number, userId: number): Promise<SolicitacaoCompra | null> {
    const solicitacao = await this.findById(id);
    if (!solicitacao) {
      throw new Error('Solicitação não encontrada');
    }

    // Verificar se há aprovadores pendentes
    const aprovacoesPendentes = await dbAll(
      `SELECT * FROM aprovacoes_solicitacao WHERE solicitacao_id = ? AND status = 'pendente'`,
      [id]
    ) as any[];

    if (aprovacoesPendentes.length === 0) {
      throw new Error('Nenhum aprovador foi selecionado para esta solicitação');
    }

    await dbRun(
      `UPDATE solicitacoes_compra 
       SET status = 'pendente_aprovacao', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'enviado_aprovacao', 'Solicitação enviada para aprovação')`,
      [id, userId]
    );

    return this.findById(id);
  }

  static async aprovar(id: number, aprovadorId: number, observacoes?: string): Promise<SolicitacaoCompra | null> {
    // Buscar aprovador
    const aprovador = await dbGet('SELECT * FROM aprovadores WHERE id = ?', [aprovadorId]) as any;
    if (!aprovador) {
      throw new Error('Aprovador não encontrado');
    }

    // Verificar se já existe registro de aprovação para este aprovador
    const aprovacaoExistente = await dbGet(
      'SELECT * FROM aprovacoes_solicitacao WHERE solicitacao_id = ? AND aprovador_id = ?',
      [id, aprovadorId]
    ) as any;

    if (aprovacaoExistente) {
      // Atualizar aprovação existente
      await dbRun(
        `UPDATE aprovacoes_solicitacao 
         SET status = 'aprovado', observacoes = ?, aprovado_em = CURRENT_TIMESTAMP
         WHERE solicitacao_id = ? AND aprovador_id = ?`,
        [observacoes || null, id, aprovadorId]
      );
    } else {
      // Criar nova aprovação
      await dbRun(
        `INSERT INTO aprovacoes_solicitacao (solicitacao_id, aprovador_id, nivel_aprovacao, status, observacoes, aprovado_em)
         VALUES (?, ?, ?, 'aprovado', ?, CURRENT_TIMESTAMP)`,
        [id, aprovadorId, aprovador.nivel_aprovacao, observacoes || null]
      );
    }

    // Verificar se todos os aprovadores aprovaram
    const todasAprovacoes = await dbAll(
      `SELECT * FROM aprovacoes_solicitacao WHERE solicitacao_id = ?`,
      [id]
    ) as any[];

    const todasAprovadas = todasAprovacoes.length > 0 && 
      todasAprovacoes.every(ap => ap.status === 'aprovado');

    if (todasAprovadas) {
      // Todos aprovaram, mudar status da solicitação para aprovada
      await dbRun(
        `UPDATE solicitacoes_compra 
         SET status = 'aprovada', aprovada_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [id]
      );
    }

    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'aprovado', ?)`,
      [id, aprovador.user_id, observacoes ? `Solicitação aprovada: ${observacoes}` : 'Solicitação aprovada']
    );

    return this.findById(id);
  }

  static async rejeitar(id: number, aprovadorId: number, motivo: string): Promise<SolicitacaoCompra | null> {
    // Buscar aprovador
    const aprovador = await dbGet('SELECT * FROM aprovadores WHERE id = ?', [aprovadorId]) as any;
    if (!aprovador) {
      throw new Error('Aprovador não encontrado');
    }

    // Atualizar ou criar registro de rejeição
    const aprovacaoExistente = await dbGet(
      'SELECT * FROM aprovacoes_solicitacao WHERE solicitacao_id = ? AND aprovador_id = ?',
      [id, aprovadorId]
    ) as any;

    if (aprovacaoExistente) {
      await dbRun(
        `UPDATE aprovacoes_solicitacao 
         SET status = 'rejeitado', observacoes = ?
         WHERE solicitacao_id = ? AND aprovador_id = ?`,
        [motivo, id, aprovadorId]
      );
    } else {
      await dbRun(
        `INSERT INTO aprovacoes_solicitacao (solicitacao_id, aprovador_id, nivel_aprovacao, status, observacoes)
         VALUES (?, ?, ?, 'rejeitado', ?)`,
        [id, aprovadorId, aprovador.nivel_aprovacao, motivo]
      );
    }

    // Se qualquer aprovador rejeitar, a solicitação é rejeitada e volta para o solicitante
    await dbRun(
      `UPDATE solicitacoes_compra 
       SET status = 'rejeitada', rejeitada_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'rejeitado', ?)`,
      [id, aprovador.user_id, `Solicitação rejeitada: ${motivo}`]
    );

    return this.findById(id);
  }

  static async atribuirComprador(id: number, compradorId: number, userId: number): Promise<SolicitacaoCompra | null> {
    await dbRun(
      `UPDATE solicitacoes_compra 
       SET comprador_id = ?, status = 'em_cotacao', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [compradorId, id]
    );

    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'atribuido_comprador', 'Comprador atribuído à solicitação')`,
      [id, userId]
    );

    return this.findById(id);
  }

  static async cancelar(id: number, userId: number, motivo?: string): Promise<SolicitacaoCompra | null> {
    await dbRun(
      `UPDATE solicitacoes_compra 
       SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    await dbRun(
      `INSERT INTO solicitacoes_compra_historico (solicitacao_id, usuario_id, acao, descricao)
       VALUES (?, ?, 'cancelado', ?)`,
      [id, userId, motivo ? `Solicitação cancelada: ${motivo}` : 'Solicitação cancelada']
    );

    return this.findById(id);
  }

  static async findByComprador(compradorUserId: number, params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    data: SolicitacaoCompra[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Buscar comprador pelo user_id
    const comprador = await dbGet(
      'SELECT id FROM compradores WHERE user_id = ? AND is_active = 1',
      [compradorUserId]
    ) as any;

    if (!comprador) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        total_pages: 0
      };
    }

    let whereClause = 'WHERE s.comprador_id = ?';
    const queryParams: any[] = [comprador.id];

    if (params.status) {
      whereClause += ' AND s.status = ?';
      queryParams.push(params.status);
    } else {
      // Por padrão, mostrar apenas solicitações em cotação
      whereClause += ' AND s.status = ?';
      queryParams.push('em_cotacao');
    }

    if (params.search) {
      whereClause += ' AND (s.numero_solicitacao LIKE ? OR s.descricao LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const solicitacoes = await dbAll(
      `SELECT s.*, 
              u.name as solicitante_name, u.email as solicitante_email,
              c.user_id as comprador_user_id, u2.name as comprador_name, u2.email as comprador_email
       FROM solicitacoes_compra s
       LEFT JOIN users u ON s.solicitante_id = u.id
       LEFT JOIN compradores c ON s.comprador_id = c.id
       LEFT JOIN users u2 ON c.user_id = u2.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      solicitacoes.map(async (s) => {
        const itens = await dbAll(
          'SELECT * FROM solicitacoes_compra_itens WHERE solicitacao_id = ? ORDER BY item_numero',
          [s.id]
        ) as any[];

        return {
          id: s.id,
          numero_solicitacao: s.numero_solicitacao,
          solicitante_id: s.solicitante_id,
          comprador_id: s.comprador_id,
          centro_custo: s.centro_custo,
          descricao: s.descricao,
          justificativa: s.justificativa,
          status: s.status,
          prioridade: s.prioridade,
          valor_total: parseFloat(s.valor_total),
          data_necessidade: s.data_necessidade ? await formatSystemDate(s.data_necessidade) : undefined,
          observacoes: s.observacoes,
          created_at: await formatSystemDate(s.created_at),
          updated_at: await formatSystemDate(s.updated_at),
          aprovada_em: s.aprovada_em ? await formatSystemDate(s.aprovada_em) : undefined,
          rejeitada_em: s.rejeitada_em ? await formatSystemDate(s.rejeitada_em) : undefined,
          itens: itens.map(item => ({
            id: item.id,
            item_numero: item.item_numero,
            descricao: item.descricao,
            quantidade: parseFloat(item.quantidade),
            unidade_medida: item.unidade_medida,
            valor_unitario: parseFloat(item.valor_unitario),
            valor_total: parseFloat(item.valor_total),
            observacoes: item.observacoes
          })),
          solicitante: {
            id: s.solicitante_id,
            name: s.solicitante_name,
            email: s.solicitante_email
          },
          comprador: s.comprador_user_id ? {
            id: s.comprador_user_id,
            name: s.comprador_name,
            email: s.comprador_email
          } : undefined,
          comprador_user_id: s.comprador_user_id || undefined
        };
      })
    );

    const total = totalResult.count;
    const total_pages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      total_pages
    };
  }

  static async findByAprovador(aprovadorUserId: number, params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{
    data: SolicitacaoCompra[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Buscar aprovador pelo user_id
    const aprovador = await dbGet(
      'SELECT id FROM aprovadores WHERE user_id = ? AND is_active = 1',
      [aprovadorUserId]
    ) as any;

    if (!aprovador) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        total_pages: 0
      };
    }

    let whereClause = `WHERE s.status = 'pendente_aprovacao' 
                       AND EXISTS (
                         SELECT 1 FROM aprovacoes_solicitacao ap 
                         WHERE ap.solicitacao_id = s.id 
                         AND ap.aprovador_id = ? 
                         AND ap.status = 'pendente'
                       )`;
    const queryParams: any[] = [aprovador.id];

    if (params.search) {
      whereClause += ' AND (s.numero_solicitacao LIKE ? OR s.descricao LIKE ?)';
      queryParams.push(`%${params.search}%`, `%${params.search}%`);
    }

    const solicitacoes = await dbAll(
      `SELECT s.*, 
              u.name as solicitante_name, u.email as solicitante_email,
              c.user_id as comprador_user_id, u2.name as comprador_name, u2.email as comprador_email
       FROM solicitacoes_compra s
       LEFT JOIN users u ON s.solicitante_id = u.id
       LEFT JOIN compradores c ON s.comprador_id = c.id
       LEFT JOIN users u2 ON c.user_id = u2.id
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      solicitacoes.map(async (s) => {
        const itens = await dbAll(
          'SELECT * FROM solicitacoes_compra_itens WHERE solicitacao_id = ? ORDER BY item_numero',
          [s.id]
        ) as any[];

        return {
          id: s.id,
          numero_solicitacao: s.numero_solicitacao,
          solicitante_id: s.solicitante_id,
          comprador_id: s.comprador_id,
          centro_custo: s.centro_custo,
          descricao: s.descricao,
          justificativa: s.justificativa,
          status: s.status,
          prioridade: s.prioridade,
          valor_total: parseFloat(s.valor_total),
          data_necessidade: s.data_necessidade ? await formatSystemDate(s.data_necessidade) : undefined,
          observacoes: s.observacoes,
          created_at: await formatSystemDate(s.created_at),
          updated_at: await formatSystemDate(s.updated_at),
          aprovada_em: s.aprovada_em ? await formatSystemDate(s.aprovada_em) : undefined,
          rejeitada_em: s.rejeitada_em ? await formatSystemDate(s.rejeitada_em) : undefined,
          itens: itens.map(item => ({
            id: item.id,
            item_numero: item.item_numero,
            descricao: item.descricao,
            quantidade: parseFloat(item.quantidade),
            unidade_medida: item.unidade_medida,
            valor_unitario: parseFloat(item.valor_unitario),
            valor_total: parseFloat(item.valor_total),
            observacoes: item.observacoes
          })),
          solicitante: {
            id: s.solicitante_id,
            name: s.solicitante_name,
            email: s.solicitante_email
          },
          comprador: s.comprador_user_id ? {
            id: s.comprador_user_id,
            name: s.comprador_name,
            email: s.comprador_email
          } : undefined,
          comprador_user_id: s.comprador_user_id || undefined
        };
      })
    );

    const total = totalResult.count;
    const total_pages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      total_pages
    };
  }

  static async getHistorico(id: number): Promise<any[]> {
    const historico = await dbAll(
      `SELECT h.*, u.name as usuario_name, u.email as usuario_email
       FROM solicitacoes_compra_historico h
       LEFT JOIN users u ON h.usuario_id = u.id
       WHERE h.solicitacao_id = ?
       ORDER BY h.created_at DESC`,
      [id]
    ) as any[];

    return historico.map(h => ({
      id: h.id,
      acao: h.acao,
      descricao: h.descricao,
      dados_anteriores: h.dados_anteriores ? JSON.parse(h.dados_anteriores) : null,
      dados_novos: h.dados_novos ? JSON.parse(h.dados_novos) : null,
      created_at: h.created_at,
      usuario: {
        id: h.usuario_id,
        name: h.usuario_name,
        email: h.usuario_email
      }
    }));
  }

  static async getStatistics(startDate?: string, endDate?: string): Promise<any> {
    let whereClause = '';
    const params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE s.created_at >= ? AND s.created_at <= ?';
      params.push(startDate, endDate);
    }

    const total = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s ${whereClause}`,
      params
    ) as { count: number };

    const byStatus = await dbAll(
      `SELECT status, COUNT(*) as count 
       FROM solicitacoes_compra s ${whereClause}
       GROUP BY status`,
      params
    ) as any[];

    const totalValue = await dbGet(
      `SELECT COALESCE(SUM(valor_total), 0) as total FROM solicitacoes_compra s ${whereClause}`,
      params
    ) as { total: number };

    const pendingApproval = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s 
       ${whereClause ? whereClause + ' AND' : 'WHERE'} s.status = 'pendente_aprovacao'`,
      params
    ) as { count: number };

    const inQuotation = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s 
       ${whereClause ? whereClause + ' AND' : 'WHERE'} s.status = 'em_cotacao'`,
      params
    ) as { count: number };

    const approved = await dbGet(
      `SELECT COUNT(*) as count FROM solicitacoes_compra s 
       ${whereClause ? whereClause + ' AND' : 'WHERE'} s.status = 'aprovada'`,
      params
    ) as { count: number };

    const statusMap: Record<string, number> = {};
    byStatus.forEach(item => {
      statusMap[item.status] = item.count;
    });

    return {
      total: total.count,
      total_value: totalValue.total,
      pending_approval: pendingApproval.count,
      in_quotation: inQuotation.count,
      approved: approved.count,
      by_status: statusMap
    };
  }

  static async delete(id: number): Promise<void> {
    // Excluir dependências primeiro (em ordem de dependência)
    // 1. Anexos relacionados aos orçamentos desta solicitação
    const orcamentos = await dbAll('SELECT id FROM orcamentos WHERE solicitacao_id = ?', [id]) as any[];
    for (const orcamento of orcamentos) {
      await dbRun('DELETE FROM compras_anexos WHERE orcamento_id = ?', [orcamento.id]);
      await dbRun('DELETE FROM orcamentos_itens WHERE orcamento_id = ?', [orcamento.id]);
      await dbRun('DELETE FROM aprovacoes_orcamento WHERE orcamento_id = ?', [orcamento.id]);
    }
    
    // 2. Orçamentos
    await dbRun('DELETE FROM orcamentos WHERE solicitacao_id = ?', [id]);
    
    // 3. Anexos da solicitação
    await dbRun('DELETE FROM compras_anexos WHERE solicitacao_id = ?', [id]);
    
    // 4. Aprovações da solicitação
    await dbRun('DELETE FROM aprovacoes_solicitacao WHERE solicitacao_id = ?', [id]);
    
    // 5. Itens da solicitação
    await dbRun('DELETE FROM solicitacoes_compra_itens WHERE solicitacao_id = ?', [id]);
    
    // 6. Histórico da solicitação
    await dbRun('DELETE FROM solicitacoes_compra_historico WHERE solicitacao_id = ?', [id]);
    
    // 7. Por fim, a solicitação
    await dbRun('DELETE FROM solicitacoes_compra WHERE id = ?', [id]);
  }
}

