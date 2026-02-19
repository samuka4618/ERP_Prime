import { Request, Response } from 'express';
import { ComprasAnexoModel } from '../models/ComprasAnexo';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import path from 'path';
import fs from 'fs';

export class ComprasAnexoController {
  static upload = asyncHandler(async (req: Request, res: Response) => {
    const { orcamentoId, solicitacaoId, tipo } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const anexos = [];

    for (const file of req.files as Express.Multer.File[]) {
      // Extrair caminho relativo (remover o caminho absoluto do process.cwd())
      const caminhoRelativo = file.path.replace(process.cwd() + path.sep, '').replace(/\\/g, '/');
      
      const anexoData = {
        orcamento_id: orcamentoId ? parseInt(orcamentoId) : undefined,
        solicitacao_id: solicitacaoId ? parseInt(solicitacaoId) : undefined,
        tipo: (tipo || 'orcamento') as 'solicitacao' | 'orcamento' | 'nota_fiscal' | 'boleto' | 'outro',
        nome_original: file.originalname,
        nome_arquivo: file.filename,
        caminho: caminhoRelativo,
        tamanho: file.size,
        mime_type: file.mimetype,
        uploaded_by: userId
      };

      const anexo = await ComprasAnexoModel.create(anexoData);
      anexos.push(anexo);
    }

    res.json({
      message: 'Arquivos anexados com sucesso',
      data: { anexos }
    });
  });

  static getByOrcamento = asyncHandler(async (req: Request, res: Response) => {
    const { orcamentoId } = req.params;
    const id = parseInt(orcamentoId);

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const anexos = await ComprasAnexoModel.findByOrcamento(id);

    res.json({
      message: 'Anexos obtidos com sucesso',
      data: { anexos }
    });
  });

  static getBySolicitacao = asyncHandler(async (req: Request, res: Response) => {
    const { solicitacaoId } = req.params;
    const id = parseInt(solicitacaoId);

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const anexos = await ComprasAnexoModel.findBySolicitacao(id);

    res.json({
      message: 'Anexos obtidos com sucesso',
      data: { anexos }
    });
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const anexoId = parseInt(id);

    if (isNaN(anexoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const anexo = await ComprasAnexoModel.findById(anexoId);
    if (!anexo) {
      res.status(404).json({ error: 'Anexo não encontrado' });
      return;
    }

    const filePath = path.join(process.cwd(), anexo.caminho);
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
      return;
    }

    res.download(filePath, anexo.nome_original);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const anexoId = parseInt(id);

    if (isNaN(anexoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const anexo = await ComprasAnexoModel.findById(anexoId);
    if (!anexo) {
      res.status(404).json({ error: 'Anexo não encontrado' });
      return;
    }

    // Verificar permissões - apenas quem fez upload ou admin pode deletar
    if (anexo.uploaded_by !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Sem permissão para deletar este anexo' });
      return;
    }

    // Deletar arquivo do sistema de arquivos
    const filePath = path.join(process.cwd(), anexo.caminho);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await ComprasAnexoModel.delete(anexoId);

    res.json({
      message: 'Anexo deletado com sucesso'
    });
  });
}

