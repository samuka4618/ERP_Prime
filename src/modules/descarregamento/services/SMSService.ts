import axios, { AxiosError } from 'axios';
import { config } from '../../../config/database';

export interface SMSOptions {
  to: string;
  message: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  statusDescription?: string;
  /** URL da API chamada (para conferência no painel Infobip) */
  apiUrl?: string;
}

/**
 * Serviço de envio de SMS via API Infobip.
 * Documentação: https://www.infobip.com/docs/api
 */
export class SMSService {
  private static get baseUrl(): string {
    const raw = (config.sms.baseUrl || '').trim();
    const defaultUrl = 'https://api.infobip.com';
    if (!raw) return defaultUrl;
    let url = raw;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    url = url.replace(/\/$/, '');
    try {
      new URL(url);
      return url;
    } catch {
      return defaultUrl;
    }
  }

  private static get apiKey(): string {
    return config.sms.apiKey || '';
  }

  private static get sender(): string {
    return config.sms.sender || '';
  }

  static async sendSMS(options: SMSOptions): Promise<SMSResult> {
    const fail = (statusDescription?: string): SMSResult => ({ success: false, statusDescription });

    if (!this.apiKey) {
      console.warn('⚠️ SMS não configurado: INFOBIP_API_KEY não definido');
      return fail('INFOBIP_API_KEY não definido');
    }

    if (!this.sender) {
      console.warn('⚠️ SMS não enviado: INFOBIP_SENDER não configurado');
      return fail('INFOBIP_SENDER não configurado');
    }

    try {
      let toNumber = options.to.replace(/[^\d+]/g, '').trim();

      if (!toNumber || toNumber.length < 10) {
        console.error(`❌ Número de telefone inválido: ${options.to}`);
        return fail('Número inválido');
      }

      if (!toNumber.startsWith('+')) {
        if (toNumber.startsWith('0')) {
          toNumber = toNumber.substring(1);
        }
        toNumber = toNumber.replace(/[^\d]/g, '');
        if (toNumber.length < 10 || toNumber.length > 11) {
          console.error(`❌ Número de telefone inválido: ${options.to} (${toNumber.length} dígitos)`);
          return fail('Número inválido');
        }
        toNumber = `55${toNumber}`;
      } else {
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(toNumber)) {
          console.error(`❌ Número em formato E.164 inválido: ${toNumber}`);
          return fail('Número inválido');
        }
      }

      const toForApi = toNumber.startsWith('+') ? toNumber.slice(1) : toNumber;
      const apiUrl = `${this.baseUrl}/sms/2/text/advanced`;

      console.log(`📤 Enviando SMS via Infobip de ${this.sender} para ${toNumber}`);
      console.log(`📡 URL da API: ${apiUrl}`);
      console.log(`📝 Mensagem (${options.message.length} caracteres): ${options.message.substring(0, 50)}${options.message.length > 50 ? '...' : ''}`);

      const response = await axios.post(
        apiUrl,
        {
          messages: [
            {
              destinations: [{ to: toForApi }],
              from: this.sender,
              text: options.message
            }
          ]
        },
        {
          headers: {
            Authorization: `App ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data as { messages?: Array<{ messageId?: string; status?: { groupId: number; groupName: string; id: number; name: string }; to?: string }> };
      if (data.messages && data.messages.length > 0) {
        const msg = data.messages[0];
        const status = msg.status;
        if (status && status.groupId === 1) {
          const messageId = msg.messageId || undefined;
          console.log(`✅ SMS aceito pela Infobip para ${toNumber} (Message ID: ${messageId || 'N/A'})`);
          return { success: true, messageId, statusDescription: status.groupName || status.name, apiUrl };
        }
        const desc = status?.groupName || status?.name || 'Rejeitado';
        console.error(`❌ Infobip rejeitou o SMS para ${toNumber}:`, desc, msg);
        return fail(desc);
      }

      console.error(`❌ Resposta inválida da Infobip:`, data);
      return fail('Resposta inválida');
    } catch (error) {
      const err = error as AxiosError<{ requestError?: { serviceException?: { messageId?: string; text?: string } } }>;
      console.error('❌ Erro ao enviar SMS:', err.message);
      if (err.response) {
        const status = err.response.status;
        const body = err.response.data;
        console.error(`   Status: ${status}`, body ? JSON.stringify(body).slice(0, 300) : '');
        if (status === 401) return fail('API Key inválida (401)');
        if (status === 403) return fail('Sem permissão ou remetente inválido (403)');
        if (status === 400) return fail('Requisição inválida (400)');
      }
      return fail(err.message || 'Erro de rede');
    }
  }

  static isConfigured(): boolean {
    return !!(config.sms.apiKey && config.sms.sender);
  }
}
