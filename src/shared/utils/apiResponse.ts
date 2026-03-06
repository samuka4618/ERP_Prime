/**
 * Padrão de resposta da API: { data?, error?, message? }
 * - Sucesso: { message?, data? }
 * - Erro: { error } (middleware de erro centralizado)
 * Use success() e created() nos controllers para respostas consistentes.
 */
import { Response } from 'express';

export function success(res: Response, data?: unknown, message = 'Operação realizada com sucesso', status = 200): Response {
  const body: { message?: string; data?: unknown } = { message };
  if (data !== undefined) body.data = data;
  return res.status(status).json(body);
}

export function created(res: Response, data?: unknown, message = 'Recurso criado com sucesso'): Response {
  return success(res, data, message, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}
