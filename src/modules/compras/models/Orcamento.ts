import { dbRun, dbGet, dbAll } from '../../../core/database/connection';
import { formatSystemDate } from '../../../shared/utils/dateUtils';

export interface OrcamentoItem {
  id?: number;
  item_solicitacao_id: number;
  descricao: string;
  quantidade: number;
  unidade_medida: string;
  valor_unitario: number;
  valor_total: number;
  observacoes?: string;
}

export interface Orcamento {
  id: number;
  solicitacao_id: number;
  fornecedor_id?: number;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_contato?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  numero_orcamento?: string;
  data_orcamento?: Date | string;
  data_validade?: Date | string;
  condicoes_pagamento?: string;
  prazo_entrega?: string;
  valor_total: number;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'devolvido' | 'cancelado';
  motivo_rejeicao?: string;
  observacoes?: string;
  anexo_path?: string;
  entrega_prevista?: Date | string;
  entrega_efetiva?: Date | string;
  status_entrega?: 'pendente' | 'em_transito' | 'entregue';
  confirmado_entrega_solicitante?: boolean;
  confirmado_entrega_comprador?: boolean;
  data_confirmacao_solicitante?: Date | string;
  data_confirmacao_comprador?: Date | string;
  criado_por: number;
  created_at: Date | string;
  updated_at: Date | string;
  aprovado_em?: Date | string;
  rejeitado_em?: Date | string;
  itens?: OrcamentoItem[];
  solicitacao?: {
    id: number;
    numero_solicitacao: string;
    solicitante_id?: number;
  };
  criado_por_usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateOrcamentoRequest {
  solicitacao_id: number;
  fornecedor_id?: number;
  fornecedor_nome: string;
  fornecedor_cnpj?: string;
  fornecedor_contato?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  numero_orcamento?: string;
  data_orcamento?: string;
  data_validade?: string;
  condicoes_pagamento?: string;
  prazo_entrega?: string;
  observacoes?: string;
  itens: Omit<OrcamentoItem, 'id'>[];
}

export interface UpdateOrcamentoRequest {
  fornecedor_nome?: string;
  fornecedor_cnpj?: string;
  fornecedor_contato?: string;
  fornecedor_email?: string;
  fornecedor_telefone?: string;
  numero_orcamento?: string;
  data_orcamento?: string;
  data_validade?: string;
  condicoes_pagamento?: string;
  prazo_entrega?: string;
  observacoes?: string;
  itens?: Omit<OrcamentoItem, 'id'>[];
}

export class OrcamentoModel {
  static async create(userId: number, data: CreateOrcamentoRequest): Promise<Orcamento> {
    // Calcular valor total
    const valorTotal = data.itens.reduce((sum, item) => {
      return sum + (item.quantidade * item.valor_unitario);
    }, 0);

    // Inserir orçamento
    await dbRun(
      `INSERT INTO orcamentos 
       (solicitacao_id, fornecedor_id, fornecedor_nome, fornecedor_cnpj, fornecedor_contato, 
        fornecedor_email, fornecedor_telefone, numero_orcamento, data_orcamento, data_validade,
        condicoes_pagamento, prazo_entrega, valor_total, observacoes, criado_por, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
      [
        data.solicitacao_id,
        data.fornecedor_id || null,
        data.fornecedor_nome,
        data.fornecedor_cnpj || null,
        data.fornecedor_contato || null,
        data.fornecedor_email || null,
        data.fornecedor_telefone || null,
        data.numero_orcamento || null,
        data.data_orcamento || null,
        data.data_validade || null,
        data.condicoes_pagamento || null,
        data.prazo_entrega || null,
        valorTotal,
        data.observacoes || null,
        userId
      ]
    );

    const orcamento = await dbGet(
      'SELECT * FROM orcamentos WHERE solicitacao_id = ? AND criado_por = ? ORDER BY id DESC LIMIT 1',
      [data.solicitacao_id, userId]
    ) as any;

    // Inserir itens
    for (const item of data.itens) {
      await dbRun(
        `INSERT INTO orcamentos_itens 
         (orcamento_id, item_solicitacao_id, descricao, quantidade, unidade_medida, valor_unitario, valor_total, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orcamento.id,
          item.item_solicitacao_id,
          item.descricao,
          item.quantidade,
          item.unidade_medida || 'UN',
          item.valor_unitario,
          item.quantidade * item.valor_unitario,
          item.observacoes || null
        ]
      );
    }

    // Buscar solicitação para obter solicitante e aprovadores
    const solicitacao = await dbGet(
      'SELECT * FROM solicitacoes_compra WHERE id = ?',
      [data.solicitacao_id]
    ) as any;

    if (!solicitacao) {
      throw new Error('Solicitação não encontrada');
    }

    // Criar aprovação para o solicitante (nível 0 - solicitante)
    await dbRun(
      `INSERT INTO aprovacoes_orcamento (orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status)
       VALUES (?, NULL, ?, 0, 'pendente')`,
      [orcamento.id, solicitacao.solicitante_id]
    );

    // Criar aprovações para os aprovadores da solicitação que aprovaram
    const aprovacoesSolicitacao = await dbAll(
      `SELECT DISTINCT aprovador_id FROM aprovacoes_solicitacao WHERE solicitacao_id = ? AND status = 'aprovado'`,
      [data.solicitacao_id]
    ) as any[];

    for (const aprovacao of aprovacoesSolicitacao) {
      const aprovador = await dbGet(
        'SELECT nivel_aprovacao FROM aprovadores WHERE id = ?',
        [aprovacao.aprovador_id]
      ) as any;

      if (aprovador) {
        await dbRun(
          `INSERT INTO aprovacoes_orcamento (orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status)
           VALUES (?, ?, NULL, ?, 'pendente')`,
          [orcamento.id, aprovacao.aprovador_id, aprovador.nivel_aprovacao]
        );
      }
    }

    // Atualizar status da solicitação
    await dbRun(
      'UPDATE solicitacoes_compra SET status = ? WHERE id = ?',
      ['cotacao_recebida', data.solicitacao_id]
    );

    const result = await this.findById(orcamento.id);
    if (!result) {
      throw new Error('Erro ao buscar orçamento criado');
    }
    return result;
  }

  static async findById(id: number): Promise<Orcamento | null> {
    const orcamento = await dbGet(
      `SELECT o.*, 
              s.numero_solicitacao, s.solicitante_id as solicitacao_solicitante_id,
              u.name as criado_por_name, u.email as criado_por_email
       FROM orcamentos o
       LEFT JOIN solicitacoes_compra s ON o.solicitacao_id = s.id
       LEFT JOIN users u ON o.criado_por = u.id
       WHERE o.id = ?`,
      [id]
    ) as any;

    if (!orcamento) return null;

    const itens = await dbAll(
      'SELECT * FROM orcamentos_itens WHERE orcamento_id = ?',
      [id]
    ) as any[];

    return this.mapOrcamentoRow(orcamento, itens);
  }

  private static async mapOrcamentoRow(orcamento: any, itens: any[]): Promise<Orcamento> {
    return {
      id: orcamento.id,
      solicitacao_id: orcamento.solicitacao_id,
      fornecedor_id: orcamento.fornecedor_id,
      fornecedor_nome: orcamento.fornecedor_nome,
      fornecedor_cnpj: orcamento.fornecedor_cnpj,
      fornecedor_contato: orcamento.fornecedor_contato,
      fornecedor_email: orcamento.fornecedor_email,
      fornecedor_telefone: orcamento.fornecedor_telefone,
      numero_orcamento: orcamento.numero_orcamento,
      data_orcamento: orcamento.data_orcamento ? await formatSystemDate(orcamento.data_orcamento) : undefined,
      data_validade: orcamento.data_validade ? await formatSystemDate(orcamento.data_validade) : undefined,
      condicoes_pagamento: orcamento.condicoes_pagamento,
      prazo_entrega: orcamento.prazo_entrega,
      valor_total: parseFloat(orcamento.valor_total),
      status: orcamento.status,
      motivo_rejeicao: orcamento.motivo_rejeicao,
      observacoes: orcamento.observacoes,
      anexo_path: orcamento.anexo_path,
      entrega_prevista: orcamento.entrega_prevista ? await formatSystemDate(orcamento.entrega_prevista) : undefined,
      entrega_efetiva: orcamento.entrega_efetiva ? await formatSystemDate(orcamento.entrega_efetiva) : undefined,
      status_entrega: orcamento.status_entrega || 'pendente',
      confirmado_entrega_solicitante: !!orcamento.confirmado_entrega_solicitante,
      confirmado_entrega_comprador: !!orcamento.confirmado_entrega_comprador,
      data_confirmacao_solicitante: orcamento.data_confirmacao_solicitante ? await formatSystemDate(orcamento.data_confirmacao_solicitante) : undefined,
      data_confirmacao_comprador: orcamento.data_confirmacao_comprador ? await formatSystemDate(orcamento.data_confirmacao_comprador) : undefined,
      criado_por: orcamento.criado_por,
      created_at: await formatSystemDate(orcamento.created_at),
      updated_at: await formatSystemDate(orcamento.updated_at),
      aprovado_em: orcamento.aprovado_em ? await formatSystemDate(orcamento.aprovado_em) : undefined,
      rejeitado_em: orcamento.rejeitado_em ? await formatSystemDate(orcamento.rejeitado_em) : undefined,
      itens: itens.map(item => ({
        id: item.id,
        item_solicitacao_id: item.item_solicitacao_id,
        descricao: item.descricao,
        quantidade: parseFloat(item.quantidade),
        unidade_medida: item.unidade_medida,
        valor_unitario: parseFloat(item.valor_unitario),
        valor_total: parseFloat(item.valor_total),
        observacoes: item.observacoes
      })),
      solicitacao: {
        id: orcamento.solicitacao_id,
        numero_solicitacao: orcamento.numero_solicitacao,
        solicitante_id: orcamento.solicitacao_solicitante_id
      },
      criado_por_usuario: {
        id: orcamento.criado_por,
        name: orcamento.criado_por_name,
        email: orcamento.criado_por_email
      }
    };
  }

  static async findBySolicitacao(solicitacaoId: number): Promise<Orcamento[]> {
    const orcamentos = await dbAll(
      `SELECT o.*, 
              s.numero_solicitacao, s.solicitante_id as solicitacao_solicitante_id,
              u.name as criado_por_name, u.email as criado_por_email
       FROM orcamentos o
       LEFT JOIN solicitacoes_compra s ON o.solicitacao_id = s.id
       LEFT JOIN users u ON o.criado_por = u.id
       WHERE o.solicitacao_id = ?
       ORDER BY o.created_at DESC`,
      [solicitacaoId]
    ) as any[];

    return Promise.all(
      orcamentos.map(async (o) => {
        const itens = await dbAll(
          'SELECT * FROM orcamentos_itens WHERE orcamento_id = ?',
          [o.id]
        ) as any[];
        return this.mapOrcamentoRow(o, itens);
      })
    );
  }

  static async findAll(params: {
    page?: number;
    limit?: number;
    status?: string;
    user_id?: number;
    only_solicitante?: boolean;
    only_comprador?: boolean;
  }): Promise<{ data: Orcamento[]; total: number; page: number; limit: number; total_pages: number }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];

    if (params.status) {
      whereClause += ' AND o.status = ?';
      queryParams.push(params.status);
    }
    if (params.user_id != null && !params.only_solicitante && !params.only_comprador) {
      whereClause += ' AND (s.solicitante_id = ? OR s.comprador_id IN (SELECT id FROM compradores WHERE user_id = ? AND is_active = 1))';
      queryParams.push(params.user_id, params.user_id);
    } else if (params.user_id != null && params.only_solicitante) {
      whereClause += ' AND s.solicitante_id = ?';
      queryParams.push(params.user_id);
    } else if (params.user_id != null && params.only_comprador) {
      whereClause += ' AND s.comprador_id IN (SELECT id FROM compradores WHERE user_id = ? AND is_active = 1)';
      queryParams.push(params.user_id);
    }

    const rows = await dbAll(
      `SELECT o.*, s.numero_solicitacao, s.solicitante_id as solicitacao_solicitante_id,
              u.name as criado_por_name, u.email as criado_por_email
       FROM orcamentos o
       LEFT JOIN solicitacoes_compra s ON o.solicitacao_id = s.id
       LEFT JOIN users u ON o.criado_por = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    ) as any[];

    const totalResult = await dbGet(
      `SELECT COUNT(*) as count FROM orcamentos o LEFT JOIN solicitacoes_compra s ON o.solicitacao_id = s.id ${whereClause}`,
      queryParams
    ) as { count: number };

    const data = await Promise.all(
      rows.map(async (o) => {
        const itens = await dbAll('SELECT * FROM orcamentos_itens WHERE orcamento_id = ?', [o.id]) as any[];
        return this.mapOrcamentoRow(o, itens);
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

  static async updateEntrega(id: number, data: {
    entrega_prevista?: string | null;
    entrega_efetiva?: string | null;
    status_entrega?: 'pendente' | 'em_transito' | 'entregue';
  }): Promise<Orcamento | null> {
    const orc = await this.findById(id);
    if (!orc || orc.status !== 'aprovado') return null;
    const fields: string[] = [];
    const values: any[] = [];
    if (data.entrega_prevista !== undefined) {
      fields.push('entrega_prevista = ?');
      values.push(data.entrega_prevista || null);
    }
    if (data.entrega_efetiva !== undefined) {
      fields.push('entrega_efetiva = ?');
      values.push(data.entrega_efetiva || null);
    }
    if (data.status_entrega !== undefined) {
      fields.push('status_entrega = ?');
      values.push(data.status_entrega);
    }
    if (fields.length === 0) return orc;
    values.push(id);
    await dbRun(
      `UPDATE orcamentos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );
    return this.findById(id);
  }

  static async confirmarEntregaSolicitante(id: number, userId: number): Promise<Orcamento | null> {
    const orc = await this.findById(id);
    if (!orc || orc.status !== 'aprovado' || orc.solicitacao?.solicitante_id !== userId) return null;
    await dbRun(
      `UPDATE orcamentos SET confirmado_entrega_solicitante = 1, data_confirmacao_solicitante = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  }

  static async confirmarEntregaComprador(id: number, userId: number): Promise<Orcamento | null> {
    const orc = await this.findById(id);
    if (!orc || orc.status !== 'aprovado') return null;
    const { CompradorModel } = await import('./Comprador');
    const comprador = await CompradorModel.findByUserId(userId);
    if (!comprador || orc.solicitacao_id === undefined) return null;
    const sol = await dbGet('SELECT comprador_id FROM solicitacoes_compra WHERE id = ?', [orc.solicitacao_id]) as any;
    if (!sol || sol.comprador_id !== comprador.id) return null;
    await dbRun(
      `UPDATE orcamentos SET confirmado_entrega_comprador = 1, data_confirmacao_comprador = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
    return this.findById(id);
  }

  static async update(id: number, data: UpdateOrcamentoRequest): Promise<Orcamento | null> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.fornecedor_nome) {
      fields.push('fornecedor_nome = ?');
      values.push(data.fornecedor_nome);
    }
    if (data.fornecedor_cnpj !== undefined) {
      fields.push('fornecedor_cnpj = ?');
      values.push(data.fornecedor_cnpj || null);
    }
    if (data.fornecedor_contato !== undefined) {
      fields.push('fornecedor_contato = ?');
      values.push(data.fornecedor_contato || null);
    }
    if (data.fornecedor_email !== undefined) {
      fields.push('fornecedor_email = ?');
      values.push(data.fornecedor_email || null);
    }
    if (data.fornecedor_telefone !== undefined) {
      fields.push('fornecedor_telefone = ?');
      values.push(data.fornecedor_telefone || null);
    }
    if (data.numero_orcamento !== undefined) {
      fields.push('numero_orcamento = ?');
      values.push(data.numero_orcamento || null);
    }
    if (data.data_orcamento !== undefined) {
      fields.push('data_orcamento = ?');
      values.push(data.data_orcamento || null);
    }
    if (data.data_validade !== undefined) {
      fields.push('data_validade = ?');
      values.push(data.data_validade || null);
    }
    if (data.condicoes_pagamento !== undefined) {
      fields.push('condicoes_pagamento = ?');
      values.push(data.condicoes_pagamento || null);
    }
    if (data.prazo_entrega !== undefined) {
      fields.push('prazo_entrega = ?');
      values.push(data.prazo_entrega || null);
    }
    if (data.observacoes !== undefined) {
      fields.push('observacoes = ?');
      values.push(data.observacoes || null);
    }

    if (fields.length > 0) {
      values.push(id);
      await dbRun(
        `UPDATE orcamentos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }

    // Atualizar itens se fornecidos
    if (data.itens) {
      await dbRun('DELETE FROM orcamentos_itens WHERE orcamento_id = ?', [id]);

      for (const item of data.itens) {
        await dbRun(
          `INSERT INTO orcamentos_itens 
           (orcamento_id, item_solicitacao_id, descricao, quantidade, unidade_medida, valor_unitario, valor_total, observacoes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.item_solicitacao_id,
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
        'SELECT * FROM orcamentos_itens WHERE orcamento_id = ?',
        [id]
      ) as any[];

      const valorTotal = itens.reduce((sum, item) => sum + parseFloat(item.valor_total), 0);
      await dbRun('UPDATE orcamentos SET valor_total = ? WHERE id = ?', [valorTotal, id]);
    }

    return this.findById(id);
  }

  static async aprovar(id: number, userId: number, observacoes?: string, isSolicitante: boolean = false): Promise<Orcamento | null> {
    const orcamento = await this.findById(id);
    if (!orcamento) return null;

    // Buscar solicitação para obter solicitante
    const solicitacao = await dbGet(
      'SELECT * FROM solicitacoes_compra WHERE id = ?',
      [orcamento.solicitacao_id]
    ) as any;

    if (isSolicitante) {
      // Aprovação do solicitante
      const aprovacaoExistente = await dbGet(
        'SELECT * FROM aprovacoes_orcamento WHERE orcamento_id = ? AND solicitante_id = ?',
        [id, userId]
      ) as any;

      if (aprovacaoExistente) {
        await dbRun(
          `UPDATE aprovacoes_orcamento 
           SET status = 'aprovado', observacoes = ?, aprovado_em = CURRENT_TIMESTAMP
           WHERE orcamento_id = ? AND solicitante_id = ?`,
          [observacoes || null, id, userId]
        );
      } else {
        await dbRun(
          `INSERT INTO aprovacoes_orcamento (orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status, observacoes, aprovado_em)
           VALUES (?, NULL, ?, 0, 'aprovado', ?, CURRENT_TIMESTAMP)`,
          [id, userId, observacoes || null]
        );
      }
    } else {
      // Aprovação de um aprovador
      const aprovador = await dbGet(
        'SELECT * FROM aprovadores WHERE user_id = ?',
        [userId]
      ) as any;

      if (!aprovador) {
        throw new Error('Usuário não é um aprovador');
      }

      const aprovacaoExistente = await dbGet(
        'SELECT * FROM aprovacoes_orcamento WHERE orcamento_id = ? AND aprovador_id = ?',
        [id, aprovador.id]
      ) as any;

      if (aprovacaoExistente) {
        await dbRun(
          `UPDATE aprovacoes_orcamento 
           SET status = 'aprovado', observacoes = ?, aprovado_em = CURRENT_TIMESTAMP
           WHERE orcamento_id = ? AND aprovador_id = ?`,
          [observacoes || null, id, aprovador.id]
        );
      } else {
        await dbRun(
          `INSERT INTO aprovacoes_orcamento (orcamento_id, aprovador_id, solicitante_id, nivel_aprovacao, status, observacoes, aprovado_em)
           VALUES (?, ?, NULL, ?, 'aprovado', ?, CURRENT_TIMESTAMP)`,
          [id, aprovador.id, aprovador.nivel_aprovacao, observacoes || null]
        );
      }
    }

    // Verificar se todos aprovaram (solicitante + todos os aprovadores)
    const todasAprovacoes = await dbAll(
      `SELECT * FROM aprovacoes_orcamento WHERE orcamento_id = ?`,
      [id]
    ) as any[];

    const todasAprovadas = todasAprovacoes.length > 0 && 
      todasAprovacoes.every(ap => ap.status === 'aprovado');

    if (todasAprovadas) {
      // Todos aprovaram, mudar status do orçamento e da solicitação
      await dbRun(
        `UPDATE orcamentos 
         SET status = 'aprovado', aprovado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [id]
      );

      await dbRun(
        'UPDATE solicitacoes_compra SET status = ? WHERE id = ?',
        ['orcamento_aprovado', orcamento.solicitacao_id]
      );
    }

    return this.findById(id);
  }

  static async rejeitar(id: number, userId: number, motivo: string, isSolicitante: boolean = false): Promise<Orcamento | null> {
    const orcamento = await this.findById(id);
    if (!orcamento) return null;

    // Buscar solicitação
    const solicitacao = await dbGet(
      'SELECT * FROM solicitacoes_compra WHERE id = ?',
      [orcamento.solicitacao_id]
    ) as any;

    if (isSolicitante) {
      // Rejeição do solicitante
      const aprovacaoExistente = await dbGet(
        'SELECT * FROM aprovacoes_orcamento WHERE orcamento_id = ? AND solicitante_id = ?',
        [id, userId]
      ) as any;

      if (aprovacaoExistente) {
        await dbRun(
          `UPDATE aprovacoes_orcamento 
           SET status = 'rejeitado', observacoes = ?
           WHERE orcamento_id = ? AND solicitante_id = ?`,
          [motivo, id, userId]
        );
      }
    } else {
      // Rejeição de um aprovador
      const aprovador = await dbGet(
        'SELECT * FROM aprovadores WHERE user_id = ?',
        [userId]
      ) as any;

      if (aprovador) {
        const aprovacaoExistente = await dbGet(
          'SELECT * FROM aprovacoes_orcamento WHERE orcamento_id = ? AND aprovador_id = ?',
          [id, aprovador.id]
        ) as any;

        if (aprovacaoExistente) {
          await dbRun(
            `UPDATE aprovacoes_orcamento 
             SET status = 'rejeitado', observacoes = ?
             WHERE orcamento_id = ? AND aprovador_id = ?`,
            [motivo, id, aprovador.id]
          );
        }
      }
    }

    // Se qualquer um rejeitar, o orçamento é rejeitado
    await dbRun(
      `UPDATE orcamentos 
       SET status = 'rejeitado', motivo_rejeicao = ?, rejeitado_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [motivo, id]
    );

    await dbRun(
      'UPDATE solicitacoes_compra SET status = ? WHERE id = ?',
      ['orcamento_rejeitado', orcamento.solicitacao_id]
    );

    return this.findById(id);
  }

  static async devolver(id: number, userId: number, motivo: string, isSolicitante: boolean = false): Promise<Orcamento | null> {
    const orcamento = await this.findById(id);
    if (!orcamento) return null;

    // Buscar solicitação
    const solicitacao = await dbGet(
      'SELECT * FROM solicitacoes_compra WHERE id = ?',
      [orcamento.solicitacao_id]
    ) as any;

    // Marcar aprovações como pendentes novamente
    if (isSolicitante) {
      await dbRun(
        `UPDATE aprovacoes_orcamento 
         SET status = 'pendente', observacoes = ?
         WHERE orcamento_id = ? AND solicitante_id = ?`,
        [motivo, id, userId]
      );
    } else {
      const aprovador = await dbGet(
        'SELECT * FROM aprovadores WHERE user_id = ?',
        [userId]
      ) as any;

      if (aprovador) {
        await dbRun(
          `UPDATE aprovacoes_orcamento 
           SET status = 'pendente', observacoes = ?
           WHERE orcamento_id = ? AND aprovador_id = ?`,
          [motivo, id, aprovador.id]
        );
      }
    }

    // Mudar status do orçamento para devolvido e voltar solicitação para cotacao_recebida
    await dbRun(
      `UPDATE orcamentos 
       SET status = 'devolvido', motivo_rejeicao = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [motivo, id]
    );

    await dbRun(
      'UPDATE solicitacoes_compra SET status = ? WHERE id = ?',
      ['cotacao_recebida', orcamento.solicitacao_id]
    );

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM orcamentos_itens WHERE orcamento_id = ?', [id]);
    await dbRun('DELETE FROM aprovacoes_orcamento WHERE orcamento_id = ?', [id]);
    await dbRun('DELETE FROM orcamentos WHERE id = ?', [id]);
  }
}

