import { Request, Response } from 'express';
import { SolicitacaoCompraModel } from '../models/SolicitacaoCompra';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import {
  createSolicitacaoCompraSchema,
  updateSolicitacaoCompraSchema,
  solicitacaoCompraQuerySchema,
  rejeitarSolicitacaoSchema,
  atribuirCompradorSchema,
  cancelarSolicitacaoSchema
} from '../schemas/solicitacaoCompra';
import Joi from 'joi';

export class SolicitacaoCompraController {
  static getStatistics = asyncHandler(async (req: Request, res: Response) => {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const statistics = await SolicitacaoCompraModel.getStatistics(startDate, endDate);

    res.json({
      message: 'Estatísticas de compras obtidas com sucesso',
      data: statistics
    });
  });
  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = createSolicitacaoCompraSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.create(userId, value);

    res.status(201).json({
      message: 'Solicitação de compra criada com sucesso',
      data: { solicitacao }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = solicitacaoCompraQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const params: any = { ...value };
    
    // Se não for admin, filtrar por solicitante
    if (req.user?.role !== 'admin') {
      params.solicitante_id = req.user?.id;
    }

    const result = await SolicitacaoCompraModel.findAll(params);

    res.json({
      message: 'Solicitações obtidas com sucesso',
      data: result
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);

    if (isNaN(solicitacaoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    // Verificar permissões
    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== req.user?.id) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    res.json({
      message: 'Solicitação obtida com sucesso',
      data: { solicitacao }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);

    if (isNaN(solicitacaoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    // Verificar permissões - apenas o solicitante pode editar rascunhos
    if (solicitacao.status !== 'rascunho' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Apenas rascunhos podem ser editados' });
      return;
    }

    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== req.user?.id) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const { error, value } = updateSolicitacaoCompraSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const updated = await SolicitacaoCompraModel.update(solicitacaoId, value);

    res.json({
      message: 'Solicitação atualizada com sucesso',
      data: { solicitacao: updated }
    });
  });

  static enviarParaAprovacao = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(solicitacaoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (solicitacao.status !== 'rascunho') {
      res.status(400).json({ error: 'Apenas rascunhos podem ser enviados para aprovação' });
      return;
    }

    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== userId) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const updated = await SolicitacaoCompraModel.enviarParaAprovacao(solicitacaoId, userId);

    res.json({
      message: 'Solicitação enviada para aprovação',
      data: { solicitacao: updated }
    });
  });

  static aprovar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(solicitacaoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    // Buscar aprovador do usuário
    const { AprovadorModel } = await import('../models/Aprovador');
    const aprovador = await AprovadorModel.findByUserId(userId);
    
    if (!aprovador) {
      res.status(403).json({ error: 'Usuário não é um aprovador' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (solicitacao.status !== 'pendente_aprovacao') {
      res.status(400).json({ error: 'Solicitação não está pendente de aprovação' });
      return;
    }

    // Verificar se o aprovador pode aprovar este valor
    if (solicitacao.valor_total < aprovador.valor_minimo || solicitacao.valor_total > aprovador.valor_maximo) {
      res.status(403).json({ error: 'Valor fora do limite de aprovação' });
      return;
    }

    const { observacoes } = req.body;
    const updated = await SolicitacaoCompraModel.aprovar(solicitacaoId, aprovador.id, observacoes);

    res.json({
      message: 'Solicitação aprovada',
      data: { solicitacao: updated }
    });
  });

  static rejeitar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(solicitacaoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const { error, value } = rejeitarSolicitacaoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    // Buscar aprovador do usuário
    const { AprovadorModel } = await import('../models/Aprovador');
    const aprovador = await AprovadorModel.findByUserId(userId);
    
    if (!aprovador) {
      res.status(403).json({ error: 'Usuário não é um aprovador' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (solicitacao.status !== 'pendente_aprovacao') {
      res.status(400).json({ error: 'Solicitação não está pendente de aprovação' });
      return;
    }

    const updated = await SolicitacaoCompraModel.rejeitar(solicitacaoId, aprovador.id, value.motivo);

    res.json({
      message: 'Solicitação rejeitada',
      data: { solicitacao: updated }
    });
  });

  static atribuirComprador = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(solicitacaoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const { error, value } = atribuirCompradorSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (solicitacao.status !== 'aprovada') {
      res.status(400).json({ error: 'Apenas solicitações aprovadas podem ter comprador atribuído' });
      return;
    }

    const updated = await SolicitacaoCompraModel.atribuirComprador(solicitacaoId, value.comprador_id, userId);

    res.json({
      message: 'Comprador atribuído com sucesso',
      data: { solicitacao: updated }
    });
  });

  static cancelar = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(solicitacaoId) || !userId) {
      res.status(400).json({ error: 'ID inválido ou usuário não autenticado' });
      return;
    }

    const { error, value } = cancelarSolicitacaoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (['comprada', 'cancelada'].includes(solicitacao.status)) {
      res.status(400).json({ error: 'Solicitação não pode ser cancelada neste status' });
      return;
    }

    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== userId) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const updated = await SolicitacaoCompraModel.cancelar(solicitacaoId, userId, value.motivo);

    res.json({
      message: 'Solicitação cancelada',
      data: { solicitacao: updated }
    });
  });

  static findByComprador = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = solicitacaoCompraQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const result = await SolicitacaoCompraModel.findByComprador(userId, value);

    res.json({
      message: 'Solicitações do comprador obtidas com sucesso',
      data: result
    });
  });

  static findByAprovador = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = solicitacaoCompraQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const result = await SolicitacaoCompraModel.findByAprovador(userId, value);

    res.json({
      message: 'Solicitações pendentes de aprovação obtidas com sucesso',
      data: result
    });
  });

  static getHistorico = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);

    if (isNaN(solicitacaoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== req.user?.id) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    const historico = await SolicitacaoCompraModel.getHistorico(solicitacaoId);

    res.json({
      message: 'Histórico obtido com sucesso',
      data: { historico }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const solicitacaoId = parseInt(id);

    if (isNaN(solicitacaoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const solicitacao = await SolicitacaoCompraModel.findById(solicitacaoId);
    if (!solicitacao) {
      res.status(404).json({ error: 'Solicitação não encontrada' });
      return;
    }

    // Verificar se o usuário tem permissão para excluir
    // Admin pode excluir qualquer solicitação
    // Usuário comum só pode excluir suas próprias solicitações
    if (req.user?.role !== 'admin' && solicitacao.solicitante_id !== req.user?.id) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    await SolicitacaoCompraModel.delete(solicitacaoId);

    res.json({
      message: 'Solicitação excluída com sucesso'
    });
  });
}

