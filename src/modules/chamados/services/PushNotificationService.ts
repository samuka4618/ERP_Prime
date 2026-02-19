import { dbAll } from '../../../core/database/connection';

interface ExpoPushMessage {
  to: string;
  sound?: string;
  title: string;
  body: string;
  data?: any;
  badge?: number;
}

export class PushNotificationService {
  private static readonly EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

  /**
   * Busca todos os tokens de push de um usuário
   */
  static async getUserPushTokens(userId: number): Promise<string[]> {
    try {
      const tokens = await dbAll(
        'SELECT push_token FROM device_push_tokens WHERE user_id = ?',
        [userId]
      ) as Array<{ push_token: string }>;

      return tokens.map(t => t.push_token);
    } catch (error) {
      console.error('Erro ao buscar tokens de push do usuário:', error);
      return [];
    }
  }

  /**
   * Envia uma notificação push para um usuário específico
   */
  static async sendPushNotification(
    userId: number,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      const tokens = await this.getUserPushTokens(userId);

      if (tokens.length === 0) {
        console.log(`📱 Nenhum token de push encontrado para o usuário ${userId}`);
        return;
      }

      const messages: ExpoPushMessage[] = tokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        badge: 1,
      }));

      // Enviar todas as notificações em lote
      const response = await fetch(this.EXPO_PUSH_API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao enviar push notification: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as { data?: Array<{ status: string; details?: { error?: string; expoPushToken?: string } }> };
      
      // Verificar se há erros nas respostas
      if (result.data) {
        const errors = result.data.filter((item: any) => item.status === 'error');
        if (errors.length > 0) {
          console.warn('⚠️ Alguns tokens de push falharam:', errors);
          
          // Remover tokens inválidos do banco
          for (const error of errors) {
            if (error.details?.error === 'DeviceNotRegistered' && error.details?.expoPushToken) {
              const invalidToken = error.details.expoPushToken;
              await this.removeInvalidToken(invalidToken);
            }
          }
        }
      }

      console.log(`✅ Push notification enviada para usuário ${userId} (${tokens.length} dispositivo(s))`);
    } catch (error) {
      console.error('❌ Erro ao enviar push notification:', error);
      // Não propagar o erro - notificações push são opcionais
    }
  }

  /**
   * Remove um token inválido do banco de dados
   */
  private static async removeInvalidToken(token: string): Promise<void> {
    try {
      const { dbRun } = await import('../../../core/database/connection');
      await dbRun(
        'DELETE FROM device_push_tokens WHERE push_token = ?',
        [token]
      );
      console.log(`🗑️ Token inválido removido: ${token.substring(0, 20)}...`);
    } catch (error) {
      console.error('Erro ao remover token inválido:', error);
    }
  }

  /**
   * Envia push notification para múltiplos usuários
   */
  static async sendPushNotificationToUsers(
    userIds: number[],
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    const promises = userIds.map(userId => 
      this.sendPushNotification(userId, title, body, data)
    );
    
    await Promise.allSettled(promises);
  }
}
