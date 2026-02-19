import { Request, Response } from 'express';
import { AttachmentModel } from '../models/Attachment';
import { asyncHandler } from '../middleware/errorHandler';
import path from 'path';
import fs from 'fs';

export class AttachmentController {
  static upload = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId, messageId } = req.body;
    const userId = req.user?.id;

    console.log('🔍 DEBUG - Request body:', { ticketId, messageId, userId });

    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado' });
      return;
    }

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' });
      return;
    }

    const attachments = [];

    for (const file of req.files as Express.Multer.File[]) {
      // Verificar se messageId é válido antes de converter
      let parsedMessageId = null;
      if (messageId && messageId !== 'undefined' && messageId !== 'null' && !isNaN(parseInt(messageId))) {
        parsedMessageId = parseInt(messageId);
        console.log('🔍 DEBUG - messageId válido:', parsedMessageId);
      } else {
        console.log('🔍 DEBUG - messageId inválido ou null:', messageId);
      }

      const attachmentData = {
        ticket_id: parseInt(ticketId),
        message_id: parsedMessageId || undefined,
        user_id: userId,
        original_name: file.originalname,
        file_name: file.filename,
        file_path: file.path,
        file_size: file.size,
        mime_type: file.mimetype
      };

      console.log('🔍 DEBUG - Dados do anexo:', attachmentData);

      const attachment = await AttachmentModel.create(attachmentData);
      attachments.push(attachment);
    }

    res.json({
      message: 'Arquivos anexados com sucesso',
      data: { attachments }
    });
  });

  static getByTicket = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticketIdNum = parseInt(ticketId);

    if (isNaN(ticketIdNum)) {
      res.status(400).json({ error: 'ID do ticket inválido' });
      return;
    }

    const attachments = await AttachmentModel.findByTicketId(ticketIdNum);

    res.json({
      message: 'Anexos obtidos com sucesso',
      data: { attachments }
    });
  });

  static getByMessage = asyncHandler(async (req: Request, res: Response) => {
    const { messageId } = req.params;
    const messageIdNum = parseInt(messageId);

    if (isNaN(messageIdNum)) {
      res.status(400).json({ error: 'ID da mensagem inválido' });
      return;
    }

    const attachments = await AttachmentModel.findByMessageId(messageIdNum);

    res.json({
      message: 'Anexos obtidos com sucesso',
      data: { attachments }
    });
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const attachmentIdNum = parseInt(attachmentId);

    if (isNaN(attachmentIdNum)) {
      res.status(400).json({ error: 'ID do anexo inválido' });
      return;
    }

    const attachment = await AttachmentModel.findById(attachmentIdNum);
    if (!attachment) {
      res.status(404).json({ error: 'Anexo não encontrado' });
      return;
    }

    const filePath = attachment.file_path;
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
      return;
    }

    // Configurar headers para download
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_name}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader('Content-Length', attachment.file_size);

    // Enviar arquivo
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const { attachmentId } = req.params;
    const attachmentIdNum = parseInt(attachmentId);

    if (isNaN(attachmentIdNum)) {
      res.status(400).json({ error: 'ID do anexo inválido' });
      return;
    }

    const attachment = await AttachmentModel.findById(attachmentIdNum);
    if (!attachment) {
      res.status(404).json({ error: 'Anexo não encontrado' });
      return;
    }

    // Verificar permissões (apenas o usuário que anexou ou admin pode deletar)
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (attachment.user_id !== userId && userRole !== 'admin') {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }

    // Deletar arquivo do sistema de arquivos
    const filePath = attachment.file_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Deletar registro do banco
    await AttachmentModel.delete(attachmentIdNum);

    res.json({
      message: 'Anexo excluído com sucesso',
      data: { success: true }
    });
  });

  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const { ticketId } = req.params;
    const ticketIdNum = parseInt(ticketId);

    if (isNaN(ticketIdNum)) {
      res.status(400).json({ error: 'ID do ticket inválido' });
      return;
    }

    const [count, totalSize] = await Promise.all([
      AttachmentModel.countByTicketId(ticketIdNum),
      AttachmentModel.getTotalSizeByTicketId(ticketIdNum)
    ]);

    res.json({
      message: 'Estatísticas de anexos obtidas com sucesso',
      data: {
        count,
        total_size: totalSize,
        total_size_mb: Math.round((totalSize / (1024 * 1024)) * 100) / 100
      }
    });
  });
}
