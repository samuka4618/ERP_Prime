import { Router } from 'express';
import fornecedoresRoutes from './routes/fornecedores';
import agendamentosRoutes from './routes/agendamentos';
import formResponsesRoutes from './routes/formResponses';
import docasRoutes from './routes/docas';
import formulariosRoutes from './routes/formularios';
import smsTemplatesRoutes from './routes/smsTemplates';

/**
 * Módulo de Descarregamento
 * Gerencia agendamentos de descarregamento, fornecedores e registro de chegada de motoristas
 */
export function registerDescarregamentoRoutes(router: Router) {
  router.use('/descarregamento/fornecedores', fornecedoresRoutes);
  router.use('/descarregamento/agendamentos', agendamentosRoutes);
  router.use('/descarregamento/form-responses', formResponsesRoutes);
  router.use('/descarregamento/docas', docasRoutes);
  router.use('/descarregamento/formularios', formulariosRoutes);
  router.use('/descarregamento/sms-templates', smsTemplatesRoutes);
}
