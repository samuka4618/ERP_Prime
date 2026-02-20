import { SMSService } from './SMSService';
import { SMSTemplateModel } from '../models/SMSTemplate';
import { AgendamentoModel, Agendamento } from '../models/Agendamento';
import { FormResponseModel, FormResponse } from '../models/FormResponse';
import { FornecedorModel } from '../models/Fornecedor';

export class DescarregamentoNotificationService {
  /**
   * Envia SMS quando motorista é chamado para descarregar (status muda para em_andamento)
   */
  static async notifyDriverCalled(agendamentoId: number): Promise<void> {
    try {
      // Buscar agendamento
      const agendamento = await AgendamentoModel.findById(agendamentoId);
      if (!agendamento || !agendamento.motorista || !agendamento.motorista.phone_number) {
        console.log(`⚠️ SMS não enviado: agendamento ${agendamentoId} não encontrado ou sem telefone do motorista`);
        return;
      }

      // Buscar template padrão para "arrival" (chamado)
      const template = await SMSTemplateModel.findDefault('arrival');
      if (!template) {
        console.log('⚠️ SMS não enviado: template padrão de "arrival" não encontrado');
        return;
      }

      // Buscar fornecedor
      const fornecedor = agendamento.fornecedor;
      if (!fornecedor) {
        console.log(`⚠️ SMS não enviado: fornecedor do agendamento ${agendamentoId} não encontrado`);
        return;
      }

      // Preparar variáveis para substituição
      const variables: Record<string, string | number> = {
        driver_name: agendamento.motorista.driver_name || 'Motorista',
        fornecedor_name: fornecedor.name,
        scheduled_date: this.formatDate(agendamento.scheduled_date),
        scheduled_time: agendamento.scheduled_time || '',
        dock: agendamento.dock || '',
        tracking_code: agendamento.motorista.driver_name || ''
      };

      // Substituir variáveis no template
      const message = await SMSTemplateModel.replaceVariables(template.message, variables);

      // Enviar SMS
      const sent = await SMSService.sendSMS({
        to: agendamento.motorista.phone_number,
        message
      });

      if (sent) {
        console.log(`✅ SMS de chamado enviado para motorista ${agendamento.motorista.driver_name} (${agendamento.motorista.phone_number})`);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar SMS de chamado:', error);
    }
  }

  /**
   * Envia SMS quando motorista é liberado (checkout)
   */
  static async notifyDriverReleased(responseId: number): Promise<void> {
    try {
      // Buscar resposta
      const response = await FormResponseModel.findById(responseId);
      if (!response || !response.phone_number) {
        console.log(`⚠️ SMS não enviado: resposta ${responseId} não encontrada ou sem telefone`);
        return;
      }

      // Buscar template padrão para "release" (liberação)
      const template = await SMSTemplateModel.findDefault('release');
      if (!template) {
        console.log('⚠️ SMS não enviado: template padrão de "release" não encontrado');
        return;
      }

      // Buscar fornecedor se disponível
      let fornecedorName = '';
      if (response.fornecedor_id) {
        const fornecedor = await FornecedorModel.findById(response.fornecedor_id);
        if (fornecedor) {
          fornecedorName = fornecedor.name;
        }
      }

      // Preparar variáveis para substituição
      const variables: Record<string, string | number> = {
        driver_name: response.driver_name || 'Motorista',
        fornecedor_name: fornecedorName,
        tracking_code: response.tracking_code || ''
      };

      // Substituir variáveis no template
      const message = await SMSTemplateModel.replaceVariables(template.message, variables);

      // Enviar SMS
      const sent = await SMSService.sendSMS({
        to: response.phone_number,
        message
      });

      if (sent) {
        console.log(`✅ SMS de liberação enviado para motorista ${response.driver_name} (${response.phone_number})`);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar SMS de liberação:', error);
    }
  }

  private static formatDate(date: string | Date): string {
    if (!date) return '';
    
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('pt-BR');
    } catch (error) {
      return String(date);
    }
  }
}
