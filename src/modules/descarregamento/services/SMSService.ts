import { Vonage } from '@vonage/server-sdk';
import { config } from '../../../config/database';

export interface SMSOptions {
  to: string;
  message: string;
}

export class SMSService {
  private static vonage: Vonage | null = null;

  private static getClient(): Vonage | null {
    // Se já foi inicializado, retornar
    if (this.vonage) {
      return this.vonage;
    }

    // Verificar se as credenciais estão configuradas
    if (!config.sms.apiKey || !config.sms.apiSecret) {
      console.warn('⚠️ SMS não configurado: VONAGE_API_KEY ou VONAGE_API_SECRET não definidos');
      return null;
    }

    // Inicializar cliente Vonage
    try {
      this.vonage = new Vonage({
        apiKey: config.sms.apiKey,
        apiSecret: config.sms.apiSecret
      });
      return this.vonage;
    } catch (error) {
      console.error('❌ Erro ao inicializar cliente Vonage:', error);
      return null;
    }
  }

  static async sendSMS(options: SMSOptions): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      console.warn('⚠️ SMS não enviado: cliente Vonage não inicializado');
      return false;
    }

    if (!config.sms.fromNumber) {
      console.warn('⚠️ SMS não enviado: VONAGE_FROM_NUMBER não configurado');
      return false;
    }

    try {
      // Formatar número de telefone (remover caracteres não numéricos, exceto +)
      let toNumber = options.to.replace(/[^\d+]/g, '').trim();
      
      // Validar se o número não está vazio
      if (!toNumber || toNumber.length < 10) {
        console.error(`❌ Número de telefone inválido: ${options.to} (muito curto após formatação)`);
        return false;
      }
      
      // Se não começar com +, assumir formato brasileiro e adicionar código do país
      if (!toNumber.startsWith('+')) {
        // Se começar com 0, remover (código de operadora)
        if (toNumber.startsWith('0')) {
          toNumber = toNumber.substring(1);
        }
        // Remover espaços e caracteres não numéricos restantes
        toNumber = toNumber.replace(/[^\d]/g, '');
        
        // Validar tamanho mínimo (10 dígitos para celular brasileiro: DDD + número)
        if (toNumber.length < 10 || toNumber.length > 11) {
          console.error(`❌ Número de telefone inválido: ${options.to} (tamanho inválido: ${toNumber.length} dígitos)`);
          return false;
        }
        
        // Adicionar código do país do Brasil (55)
        toNumber = `55${toNumber}`;
      } else {
        // Se já tem +, validar formato E.164
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(toNumber)) {
          console.error(`❌ Número de telefone em formato E.164 inválido: ${toNumber}`);
          return false;
        }
      }

      console.log(`📤 Enviando SMS de ${config.sms.fromNumber} para ${toNumber}`);
      console.log(`📝 Mensagem (${options.message.length} caracteres): ${options.message.substring(0, 50)}${options.message.length > 50 ? '...' : ''}`);

      // Enviar SMS conforme documentação da Vonage
      const response = await client.sms.send({
        to: toNumber,
        from: config.sms.fromNumber,
        text: options.message
      });

      // Verificar resposta conforme documentação da Vonage
      if (response.messages && response.messages.length > 0) {
        const message = response.messages[0];
        
        // Log detalhado da resposta
        console.log(`📨 Resposta da Vonage para ${toNumber}:`, {
          status: message.status,
          'message-id': (message as any).messageId || 'N/A',
          'error-text': (message as any).errorText || 'N/A',
          'remaining-balance': (message as any).remainingBalance || 'N/A'
        });

        // Converter status para string para comparação
        const statusStr = String(message.status);
        
        if (statusStr === '0') {
          console.log(`✅ SMS aceito pela plataforma Vonage para ${toNumber} (Message ID: ${(message as any).messageId || 'N/A'})`);
          console.log(`ℹ️  Observação: O status de entrega (DLR) será atualizado posteriormente via webhook/callback`);
          return true;
        } else {
          const errorMsg = (message as any).errorText || 'Erro desconhecido';
          const errorCode = statusStr;
          const messageId = (message as any).messageId || 'N/A';
          
          console.error(`❌ Erro ao enviar SMS para ${toNumber}:`, {
            status: errorCode,
            error: errorMsg,
            'message-id': messageId
          });
          
          // Mensagens de erro comuns e sugestões
          if (errorCode === '1') {
            console.error(`   ⚠️  STATUS 1 - THROTTLED ou número inválido`);
            console.error(`   💡 Possíveis causas:`);
            console.error(`      • Número de destino pode não estar validado na conta Vonage`);
            console.error(`      • Conta Vonage pode estar em modo sandbox/teste (permite apenas números autorizados)`);
            console.error(`      • Número pode estar incorreto ou inativo`);
            console.error(`      • Limite de taxa (throttling) atingido`);
            console.error(`   💡 Soluções:`);
            console.error(`      • Verifique se o número ${toNumber} está na lista de números autorizados no dashboard Vonage`);
            console.error(`      • Para contas de teste: adicione o número em "Numbers" > "Verified numbers"`);
            console.error(`      • Verifique se a conta Vonage está em modo produção (não sandbox)`);
            console.error(`      • Confirme que o número está ativo e pode receber SMS`);
          } else if (errorCode === '2') {
            console.error(`   ⚠️  STATUS 2 - MISSING PARAMS`);
            console.error(`   💡 Verifique o formato do número remetente (VONAGE_FROM_NUMBER): ${config.sms.fromNumber}`);
          } else if (errorCode === '3') {
            console.error(`   ⚠️  STATUS 3 - INVALID PARAMS`);
            console.error(`   💡 Verifique sua conta Vonage e créditos`);
          } else if (errorCode === '4') {
            console.error(`   ⚠️  STATUS 4 - INVALID CREDENTIALS`);
            console.error(`   💡 Verifique VONAGE_API_KEY e VONAGE_API_SECRET`);
          } else if (errorCode === '5') {
            console.error(`   ⚠️  STATUS 5 - INTERNAL ERROR`);
            console.error(`   💡 Erro interno da Vonage, tente novamente mais tarde`);
          } else if (errorCode === '6') {
            console.error(`   ⚠️  STATUS 6 - INVALID MESSAGE`);
            console.error(`   💡 Verifique o conteúdo da mensagem`);
          } else if (errorCode === '7') {
            console.error(`   ⚠️  STATUS 7 - NUMBER BARred`);
            console.error(`   💡 O número de destino está bloqueado ou não pode receber SMS`);
          } else if (errorCode === '8') {
            console.error(`   ⚠️  STATUS 8 - PARTNER ACCOUNT BARred`);
            console.error(`   💡 Sua conta Vonage está bloqueada, entre em contato com o suporte`);
          } else if (errorCode === '9') {
            console.error(`   ⚠️  STATUS 9 - PARTNER QUOTA EXCEEDED`);
            console.error(`   💡 Cota da conta Vonage excedida, verifique seus créditos`);
          } else if (errorCode === '10') {
            console.error(`   ⚠️  STATUS 10 - TOO MANY EXISTING BINDS`);
            console.error(`   💡 Muitas conexões ativas`);
          } else if (errorCode === '11') {
            console.error(`   ⚠️  STATUS 11 - ACCOUNT NOT ENABLED FOR HTTP`);
            console.error(`   💡 Conta não habilitada para HTTP`);
          } else if (errorCode === '12') {
            console.error(`   ⚠️  STATUS 12 - MESSAGE TOO LONG`);
            console.error(`   💡 Mensagem muito longa (máximo 1600 caracteres para SMS concatenado)`);
          } else if (errorCode === '13') {
            console.error(`   ⚠️  STATUS 13 - INVALID SIGNATURE`);
            console.error(`   💡 Assinatura inválida`);
          } else if (errorCode === '14') {
            console.error(`   ⚠️  STATUS 14 - INVALID SENDER ADDRESS`);
            console.error(`   💡 Endereço do remetente (VONAGE_FROM_NUMBER) inválido: ${config.sms.fromNumber}`);
          } else if (errorCode === '15') {
            console.error(`   ⚠️  STATUS 15 - INVALID TTL`);
            console.error(`   💡 TTL inválido`);
          } else if (errorCode === '16') {
            console.error(`   ⚠️  STATUS 16 - FACILITY NOT ALLOWED`);
            console.error(`   💡 Funcionalidade não permitida para esta conta`);
          } else if (errorCode === '19') {
            console.error(`   ⚠️  STATUS 19 - INVALID MOBILE NUMBER`);
            console.error(`   💡 Número de celular inválido: ${toNumber}`);
          } else if (errorCode === '20') {
            console.error(`   ⚠️  STATUS 20 - NETWORK NOT SUPPORTED`);
            console.error(`   💡 Rede não suportada para o número: ${toNumber}`);
          } else {
            console.error(`   ⚠️  STATUS ${errorCode} - ${errorMsg}`);
            console.error(`   💡 Consulte a documentação da Vonage para mais detalhes sobre este código`);
          }
          
          return false;
        }
      } else {
        console.error(`❌ Erro ao enviar SMS para ${toNumber}: Resposta inválida da API (nenhuma mensagem na resposta)`);
        console.error(`   Resposta completa:`, JSON.stringify(response, null, 2));
        return false;
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar SMS:', error);
      if (error.message) {
        console.error('   Detalhes:', error.message);
      }
      if (error.response) {
        console.error('   Resposta do servidor:', JSON.stringify(error.response.data || error.response, null, 2));
      }
      return false;
    }
  }

  static isConfigured(): boolean {
    return !!(config.sms.apiKey && config.sms.apiSecret && config.sms.fromNumber);
  }
}
