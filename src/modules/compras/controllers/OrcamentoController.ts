import { Request, Response } from 'express';
import { OrcamentoModel } from '../models/Orcamento';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import {
  createOrcamentoSchema,
  updateOrcamentoSchema,
  aprovarOrcamentoSchema,
  rejeitarOrcamentoSchema,
  devolverOrcamentoSchema,
  orcamentoListQuerySchema,
  updateEntregaSchema
} from '../schemas/orcamento';
import Joi from 'joi';

export class OrcamentoController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = createOrcamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    // Verificar se o usuário é o comprador atribuído à solicitação
    const { SolicitacaoCompraModel } = await import('../models/SolicitacaoCompra');
    const solicitacao = await SolicitacaoCompraModel.findById(value.solicitacao_id);
    
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (solicitacao.status !== 'em_cotacao') {
      res.status(400).json({ error: 'Apenas solicitações em cotação podem receber orçamentos' });
      return;
    }

    // Verificar se o usuário é o comprador atribuído
    // Buscar comprador pelo user_id se necessário
    if (solicitacao.comprador_id) {
      const { CompradorModel } = await import('../models/Comprador');
      const comprador = await CompradorModel.findById(solicitacao.comprador_id);
      
      if (comprador && comprador.user_id !== userId && req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Apenas o comprador atribuído pode criar orçamentos para esta solicitação' });
        return;
      }
    } else if (req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Nenhum comprador foi atribuído a esta solicitação' });
      return;
    }

    const orcamento = await OrcamentoModel.create(userId, value);

    res.status(201).json({
      message: 'Orçamento criado com sucesso',
      data: { orcamento }
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);

    if (isNaN(orcamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    res.json({
      message: 'Orçamento obtido com sucesso',
      data: { orcamento }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = orcamentoListQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }
    const userId = req.user?.id;
    const role = req.user?.role;
    const listParams: { page?: number; limit?: number; status?: string; user_id?: number } = {
      page: value.page,
      limit: value.limit,
      status: value.status
    };
    if (role !== 'admin' && userId != null) {
      listParams.user_id = userId;
    }
    const result = await OrcamentoModel.findAll(listParams);
    res.json({
      message: 'Orçamentos obtidos com sucesso',
      data: result
    });
  });

  static findBySolicitacao = asyncHandler(async (req: Request, res: Response) => {
    const { solicitacaoId } = req.params;
    const id = parseInt(solicitacaoId);

    if (isNaN(id)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const orcamentos = await OrcamentoModel.findBySolicitacao(id);

    res.json({
      message: 'Orçamentos obtidos com sucesso',
      data: { orcamentos }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);

    if (isNaN(orcamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    if (orcamento.status !== 'pendente' && req.user?.role !== 'admin') {
      res.status(400).json({ error: 'Apenas orçamentos pendentes podem ser editados' });
      return;
    }

    const { error, value } = updateOrcamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const updated = await OrcamentoModel.update(orcamentoId, value);

    res.json({
      message: 'Orçamento atualizado com sucesso',
      data: { orcamento: updated }
    });
  });

  static aprovar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    // Buscar solicitação para verificar se é o solicitante
    const { SolicitacaoCompraModel } = await import('../models/SolicitacaoCompra');
    const solicitacao = await SolicitacaoCompraModel.findById(orcamento.solicitacao_id);
    
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    const isSolicitante = solicitacao.solicitante_id === userId;
    const { AprovadorModel } = await import('../models/Aprovador');
    const aprovador = await AprovadorModel.findByUserId(userId);

    // Verificar se é solicitante ou aprovador
    if (!isSolicitante && !aprovador) {
      res.status(403).json({ error: 'Usuário não tem permissão para aprovar este orçamento' });
      return;
    }

    if (!isSolicitante && aprovador) {
      // Verificar limites de aprovação do aprovador
      if (orcamento.valor_total < aprovador.valor_minimo || orcamento.valor_total > aprovador.valor_maximo) {
        res.status(403).json({ error: 'Valor fora do limite de aprovação' });
        return;
      }
    }

    if (!['pendente', 'devolvido'].includes(orcamento.status)) {
      res.status(400).json({ error: 'Orçamento não está pendente de aprovação' });
      return;
    }

    const { error, value } = aprovarOrcamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const updated = await OrcamentoModel.aprovar(orcamentoId, userId, value.observacoes, isSolicitante);

    res.json({
      message: 'Orçamento aprovado',
      data: { orcamento: updated }
    });
  });

  static rejeitar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const { error, value } = rejeitarOrcamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    // Buscar solicitação para verificar se é o solicitante
    const { SolicitacaoCompraModel } = await import('../models/SolicitacaoCompra');
    const solicitacao = await SolicitacaoCompraModel.findById(orcamento.solicitacao_id);
    
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    const isSolicitante = solicitacao.solicitante_id === userId;
    const { AprovadorModel } = await import('../models/Aprovador');
    const aprovador = await AprovadorModel.findByUserId(userId);

    // Verificar se é solicitante ou aprovador
    if (!isSolicitante && !aprovador) {
      res.status(403).json({ error: 'Usuário não tem permissão para rejeitar este orçamento' });
      return;
    }

    if (!['pendente', 'devolvido'].includes(orcamento.status)) {
      res.status(400).json({ error: 'Orçamento não está pendente de aprovação' });
      return;
    }

    const updated = await OrcamentoModel.rejeitar(orcamentoId, userId, value.motivo, isSolicitante);

    res.json({
      message: 'Orçamento rejeitado',
      data: { orcamento: updated }
    });
  });

  static devolver = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const { error, value } = devolverOrcamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    // Buscar solicitação para verificar se é o solicitante
    const { SolicitacaoCompraModel } = await import('../models/SolicitacaoCompra');
    const solicitacao = await SolicitacaoCompraModel.findById(orcamento.solicitacao_id);
    
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    const isSolicitante = solicitacao.solicitante_id === userId;
    const { AprovadorModel } = await import('../models/Aprovador');
    const aprovador = await AprovadorModel.findByUserId(userId);

    // Verificar se é solicitante ou aprovador
    if (!isSolicitante && !aprovador) {
      res.status(403).json({ error: 'Usuário não tem permissão para devolver este orçamento' });
      return;
    }

    if (!['pendente', 'aprovado'].includes(orcamento.status)) {
      res.status(400).json({ error: 'Orçamento não pode ser devolvido neste status' });
      return;
    }

    const updated = await OrcamentoModel.devolver(orcamentoId, userId, value.motivo, isSolicitante);

    res.json({
      message: 'Orçamento devolvido para correção',
      data: { orcamento: updated }
    });
  });

  static updateEntrega = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;
    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }
    const { error, value } = updateEntregaSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }
    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }
    if (orcamento.status !== 'aprovado') {
      res.status(400).json({ error: 'Apenas orçamentos aprovados podem ter entrega atualizada' });
      return;
    }
    const { CompradorModel } = await import('../models/Comprador');
    const comprador = await CompradorModel.findByUserId(userId);
    const { SolicitacaoCompraModel } = await import('../models/SolicitacaoCompra');
    const solicitacao = await SolicitacaoCompraModel.findById(orcamento.solicitacao_id);
    const isComprador = comprador && solicitacao?.comprador_id === comprador.id;
    const isSolicitante = solicitacao?.solicitante_id === userId;
    if (!isComprador && !isSolicitante && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Sem permissão para atualizar entrega deste orçamento' });
      return;
    }
    const data: { entrega_prevista?: string | null; entrega_efetiva?: string | null; status_entrega?: 'pendente' | 'em_transito' | 'entregue' } = {};
    if (value.entrega_prevista !== undefined) data.entrega_prevista = value.entrega_prevista ? (value.entrega_prevista instanceof Date ? value.entrega_prevista.toISOString().split('T')[0] : String(value.entrega_prevista)) : null;
    if (value.entrega_efetiva !== undefined) data.entrega_efetiva = value.entrega_efetiva ? (value.entrega_efetiva instanceof Date ? value.entrega_efetiva.toISOString().split('T')[0] : String(value.entrega_efetiva)) : null;
    if (value.status_entrega !== undefined) data.status_entrega = value.status_entrega;
    const updated = await OrcamentoModel.updateEntrega(orcamentoId, data);
    res.json({
      message: 'Entrega atualizada',
      data: { orcamento: updated }
    });
  });

  static confirmarEntregaSolicitante = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;
    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }
    const updated = await OrcamentoModel.confirmarEntregaSolicitante(orcamentoId, userId);
    if (!updated) {
      res.status(403).json({ error: 'Apenas o solicitante pode confirmar a entrega' });
      return;
    }
    res.json({
      message: 'Entrega confirmada pelo solicitante',
      data: { orcamento: updated }
    });
  });

  static confirmarEntregaComprador = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);
    const userId = req.user?.id;
    if (isNaN(orcamentoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }
    const updated = await OrcamentoModel.confirmarEntregaComprador(orcamentoId, userId);
    if (!updated) {
      res.status(403).json({ error: 'Apenas o comprador pode confirmar a entrega' });
      return;
    }
    res.json({
      message: 'Entrega confirmada pelo comprador',
      data: { orcamento: updated }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const orcamentoId = parseInt(id);

    if (isNaN(orcamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const orcamento = await OrcamentoModel.findById(orcamentoId);
    if (!orcamento) {
      res.status(404).json({ error: 'Orçamento não encontrado' });
      return;
    }

    if (orcamento.status !== 'pendente' && req.user?.role !== 'admin') {
      res.status(400).json({ error: 'Apenas orçamentos pendentes podem ser excluídos' });
      return;
    }

    await OrcamentoModel.delete(orcamentoId);

    res.json({
      message: 'Orçamento excluído com sucesso'
    });
  });
}


