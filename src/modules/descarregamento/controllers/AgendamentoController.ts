import { Request, Response } from 'express';
import { AgendamentoModel } from '../models/Agendamento';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createAgendamentoSchema, updateAgendamentoSchema, agendamentoQuerySchema } from '../schemas/agendamento';

export class AgendamentoController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    const { error, value } = createAgendamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const agendamento = await AgendamentoModel.create(userId, value);

    res.status(201).json({
      message: 'Agendamento criado com sucesso',
      data: { agendamento }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = agendamentoQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const result = await AgendamentoModel.findAll(value);

    res.json({
      message: 'Agendamentos obtidos com sucesso',
      data: result
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const agendamentoId = parseInt(id);

    if (isNaN(agendamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const agendamento = await AgendamentoModel.findById(agendamentoId);
    if (!agendamento) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }

    res.json({
      message: 'Agendamento obtido com sucesso',
      data: { agendamento }
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const agendamentoId = parseInt(id);
    const userId = req.user?.id;

    if (isNaN(agendamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const { error, value } = updateAgendamentoSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const agendamento = await AgendamentoModel.update(agendamentoId, value, userId);
    if (!agendamento) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }

    res.json({
      message: 'Agendamento atualizado com sucesso',
      data: { agendamento }
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const agendamentoId = parseInt(id);

    if (isNaN(agendamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const agendamento = await AgendamentoModel.findById(agendamentoId);
    if (!agendamento) {
      res.status(404).json({ error: 'Agendamento não encontrado' });
      return;
    }

    await AgendamentoModel.delete(agendamentoId);

    res.json({
      message: 'Agendamento excluído com sucesso'
    });
  });

  static getStatusHistory = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const agendamentoId = parseInt(id);

    if (isNaN(agendamentoId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const history = await AgendamentoModel.getStatusHistory(agendamentoId);

    res.json({
      message: 'Histórico de status obtido com sucesso',
      data: { history }
    });
  });

  static getByDateRange = asyncHandler(async (req: Request, res: Response) => {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      res.status(400).json({ error: 'start_date e end_date são obrigatórios' });
      return;
    }

    const agendamentos = await AgendamentoModel.getByDateRange(
      start_date as string,
      end_date as string
    );

    res.json({
      message: 'Agendamentos obtidos com sucesso',
      data: { agendamentos }
    });
  });
}
