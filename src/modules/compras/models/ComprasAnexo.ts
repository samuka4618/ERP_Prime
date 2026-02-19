import { dbRun, dbGet, dbAll } from '../../../core/database/connection';

export interface ComprasAnexo {
  id: number;
  solicitacao_id?: number;
  orcamento_id?: number;
  tipo: 'solicitacao' | 'orcamento' | 'nota_fiscal' | 'boleto' | 'outro';
  nome_original: string;
  nome_arquivo: string;
  caminho: string;
  tamanho: number;
  mime_type?: string;
  uploaded_by: number;
  created_at: Date | string;
  usuario?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CreateComprasAnexoRequest {
  solicitacao_id?: number;
  orcamento_id?: number;
  tipo: 'solicitacao' | 'orcamento' | 'nota_fiscal' | 'boleto' | 'outro';
  nome_original: string;
  nome_arquivo: string;
  caminho: string;
  tamanho: number;
  mime_type?: string;
  uploaded_by: number;
}

export class ComprasAnexoModel {
  static async create(data: CreateComprasAnexoRequest): Promise<ComprasAnexo> {
    const result = await dbRun(
      `INSERT INTO compras_anexos 
       (solicitacao_id, orcamento_id, tipo, nome_original, nome_arquivo, caminho, tamanho, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.solicitacao_id || null,
        data.orcamento_id || null,
        data.tipo,
        data.nome_original,
        data.nome_arquivo,
        data.caminho,
        data.tamanho,
        data.mime_type || null,
        data.uploaded_by
      ]
    );

    const anexo = await this.findById(result.lastID);
    if (!anexo) {
      throw new Error('Erro ao buscar anexo criado');
    }
    return anexo;
  }

  static async findById(id: number): Promise<ComprasAnexo | null> {
    const anexo = await dbGet(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM compras_anexos a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.id = ?`,
      [id]
    ) as any;

    if (!anexo) return null;

    return {
      id: anexo.id,
      solicitacao_id: anexo.solicitacao_id,
      orcamento_id: anexo.orcamento_id,
      tipo: anexo.tipo,
      nome_original: anexo.nome_original,
      nome_arquivo: anexo.nome_arquivo,
      caminho: anexo.caminho,
      tamanho: anexo.tamanho,
      mime_type: anexo.mime_type,
      uploaded_by: anexo.uploaded_by,
      created_at: anexo.created_at,
      usuario: anexo.usuario_name ? {
        id: anexo.uploaded_by,
        name: anexo.usuario_name,
        email: anexo.usuario_email
      } : undefined
    };
  }

  static async findByOrcamento(orcamentoId: number): Promise<ComprasAnexo[]> {
    const anexos = await dbAll(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM compras_anexos a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.orcamento_id = ?
       ORDER BY a.created_at DESC`,
      [orcamentoId]
    ) as any[];

    return anexos.map(anexo => ({
      id: anexo.id,
      solicitacao_id: anexo.solicitacao_id,
      orcamento_id: anexo.orcamento_id,
      tipo: anexo.tipo,
      nome_original: anexo.nome_original,
      nome_arquivo: anexo.nome_arquivo,
      caminho: anexo.caminho,
      tamanho: anexo.tamanho,
      mime_type: anexo.mime_type,
      uploaded_by: anexo.uploaded_by,
      created_at: anexo.created_at,
      usuario: anexo.usuario_name ? {
        id: anexo.uploaded_by,
        name: anexo.usuario_name,
        email: anexo.usuario_email
      } : undefined
    }));
  }

  static async findBySolicitacao(solicitacaoId: number): Promise<ComprasAnexo[]> {
    const anexos = await dbAll(
      `SELECT a.*, u.name as usuario_name, u.email as usuario_email
       FROM compras_anexos a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.solicitacao_id = ?
       ORDER BY a.created_at DESC`,
      [solicitacaoId]
    ) as any[];

    return anexos.map(anexo => ({
      id: anexo.id,
      solicitacao_id: anexo.solicitacao_id,
      orcamento_id: anexo.orcamento_id,
      tipo: anexo.tipo,
      nome_original: anexo.nome_original,
      nome_arquivo: anexo.nome_arquivo,
      caminho: anexo.caminho,
      tamanho: anexo.tamanho,
      mime_type: anexo.mime_type,
      uploaded_by: anexo.uploaded_by,
      created_at: anexo.created_at,
      usuario: anexo.usuario_name ? {
        id: anexo.uploaded_by,
        name: anexo.usuario_name,
        email: anexo.usuario_email
      } : undefined
    }));
  }

  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM compras_anexos WHERE id = ?', [id]);
  }
}

