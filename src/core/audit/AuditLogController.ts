import { Request, Response } from 'express';
import { asyncHandler } from '../../shared/middleware/errorHandler';
import * as AuditLogModel from './AuditLogModel';

export class AuditLogController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const dateFrom = req.query.date_from as string | undefined;
    const dateTo = req.query.date_to as string | undefined;
    const userId = req.query.user_id ? parseInt(String(req.query.user_id), 10) : undefined;
    const action = req.query.action as string | undefined;
    const resource = req.query.resource as string | undefined;

    const result = await AuditLogModel.findAll({
      page,
      limit,
      dateFrom,
      dateTo,
      userId,
      action,
      resource
    });

    res.json({
      message: 'OK',
      data: result
    });
  });
}
