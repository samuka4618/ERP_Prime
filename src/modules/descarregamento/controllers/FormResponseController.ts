import { Request, Response } from 'express';
import Joi from 'joi';
import { FormResponseModel } from '../models/FormResponse';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { createFormResponseSchema, formResponseQuerySchema } from '../schemas/formResponse';
import { SatelliteSyncService } from '../services/SatelliteSyncService';

const startDischargeBodySchema = Joi.object({
  dock: Joi.string().allow('', null).max(50).optional()
});

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

    if (updatedResponse?.satellite_submission_id) {
      SatelliteSyncService.pushDriverState(
        updatedResponse.satellite_submission_id,
        'completed',
        'Descarga concluída. Obrigado!'
      ).catch((err) => console.error('Satellite pushDriverState (checkout):', err));
    }

    res.json({
      message: 'Motorista liberado com sucesso',
      data: { response: updatedResponse }
    });
  });

  /** Inicia a descarga (status "realizando descarga"). Requer confirmação posterior via checkout. */
  static startDischarge = asyncHandler(async (req: Request, res: Response) => {
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

    const { error: bodyErr, value: bodyValue } = startDischargeBodySchema.validate(req.body || {});
    if (bodyErr) {
      res.status(400).json({ error: 'Dados inválidos', details: bodyErr.details.map((d) => d.message) });
      return;
    }

    let updatedResponse: Awaited<ReturnType<typeof FormResponseModel.startDischarge>>;
    try {
      updatedResponse = await FormResponseModel.startDischarge(responseId, bodyValue.dock);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'DOCK_REQUIRED') {
        res.status(400).json({ error: 'Informe a doca para liberar o motorista.' });
        return;
      }
      if (msg === 'DOCK_INVALID') {
        res.status(400).json({ error: 'Doca informada não encontrada ou inativa.' });
        return;
      }
      throw e;
    }

    if (!updatedResponse) {
      res.status(400).json({ error: 'Não foi possível iniciar a descarga' });
      return;
    }

    if (updatedResponse.satellite_submission_id) {
      SatelliteSyncService.pushDriverState(
        updatedResponse.satellite_submission_id,
        'dock_released',
        'Liberado para descarregamento na doca.'
      ).catch((err) => console.error('Satellite pushDriverState (dock):', err));
    }

    res.json({
      message: 'Descarga iniciada. Confirme a conclusão quando o motorista terminar.',
      data: { response: updatedResponse }
    });
  });
}
