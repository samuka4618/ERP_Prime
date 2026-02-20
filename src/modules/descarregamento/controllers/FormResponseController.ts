import { Request, Response } from 'express';
import { FormResponseModel } from '../models/FormResponse';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createFormResponseSchema, formResponseQuerySchema } from '../schemas/formResponse';

export class FormResponseController {
  // Rota pública para registro de chegada (sem autenticação)
  static create = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = createFormResponseSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: 'Dados inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const response = await FormResponseModel.create(value);

    res.status(201).json({
      message: 'Chegada registrada com sucesso',
      data: { 
        response,
        tracking_url: `/descarregamento/acompanhamento/${response.tracking_code}`
      }
    });
  });

  static findAll = asyncHandler(async (req: Request, res: Response) => {
    const { error, value } = formResponseQuerySchema.validate(req.query);
    if (error) {
      res.status(400).json({ error: 'Parâmetros inválidos', details: error.details.map(d => d.message) });
      return;
    }

    const result = await FormResponseModel.findAll(value);

    res.json({
      message: 'Registros obtidos com sucesso',
      data: result
    });
  });

  static findById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const responseId = parseInt(id);

    if (isNaN(responseId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const response = await FormResponseModel.findById(responseId);
    if (!response) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }

    res.json({
      message: 'Registro obtido com sucesso',
      data: { response }
    });
  });

  static findByTrackingCode = asyncHandler(async (req: Request, res: Response) => {
    const { trackingCode } = req.params;

    const response = await FormResponseModel.findByTrackingCode(trackingCode);
    if (!response) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }

    res.json({
      message: 'Registro obtido com sucesso',
      data: { response }
    });
  });

  static findInYard = asyncHandler(async (req: Request, res: Response) => {
    const responses = await FormResponseModel.findInYard();

    res.json({
      message: 'Motoristas no pátio obtidos com sucesso',
      data: { responses }
    });
  });

  static checkout = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const responseId = parseInt(id);

    if (isNaN(responseId)) {
      res.status(400).json({ error: 'ID inválido' });
      return;
    }

    const response = await FormResponseModel.findById(responseId);
    if (!response) {
      res.status(404).json({ error: 'Registro não encontrado' });
      return;
    }

    if (!response.is_in_yard) {
      res.status(400).json({ error: 'Motorista já não está mais no pátio' });
      return;
    }

    const updatedResponse = await FormResponseModel.checkout(responseId);

    res.json({
      message: 'Motorista liberado com sucesso',
      data: { response: updatedResponse }
    });
  });
}
