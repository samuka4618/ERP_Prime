import QRCode from 'qrcode';
import { config } from '../../../config/database';
import os from 'os';
import { NgrokService } from './NgrokService';

/**
 * Serviço para gerar QR codes de formulários publicados
 */
export class QRCodeService {
  /**
   * Gera URL pública do formulário
   */
  static async getPublicFormUrl(formularioId: number): Promise<string> {
    // Primeiro, verificar se ngrok está ativo (para desenvolvimento/testes)
    const ngrokUrl = await NgrokService.getNgrokUrl();
    if (ngrokUrl) {
      return `${ngrokUrl}/descarregamento/formulario/${formularioId}`;
    }

    // Se não houver ngrok, usar configuração padrão
    const hostname = this.getPublicHostname();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const port = process.env.NODE_ENV === 'production' ? '' : `:${config.port}`;
    
    return `${protocol}://${hostname}${port}/descarregamento/formulario/${formularioId}`;
  }

  /**
   * Obtém o hostname público
   */
  private static getPublicHostname(): string {
    // Se houver variável de ambiente PUBLIC_URL completa, usar ela
    if (process.env.PUBLIC_URL) {
      const url = process.env.PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
      // Se contém porta, remover (será adicionada depois)
      return url.split(':')[0];
    }

    // Se houver variável de ambiente PUBLIC_HOSTNAME, usar ela
    if (process.env.PUBLIC_HOSTNAME) {
      return process.env.PUBLIC_HOSTNAME;
    }

    // Em produção, tentar usar hostname do sistema
    if (process.env.NODE_ENV === 'production') {
      return process.env.HOSTNAME || 'localhost';
    }

    // Em desenvolvimento, obter IP da rede local (não localhost)
    const interfaces = os.networkInterfaces();
    const priorityInterfaces = ['Ethernet', 'Wi-Fi', 'eth0', 'wlan0', 'en0'];
    
    // Tentar encontrar IP em interfaces prioritárias
    for (const ifaceName of priorityInterfaces) {
      const iface = interfaces[ifaceName];
      if (iface) {
        for (const addr of iface) {
          // Usar IPv4 que não seja loopback (127.0.0.1) ou link-local (169.254.x.x)
          if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
            console.log(`✅ IP público detectado: ${addr.address} (interface: ${ifaceName})`);
            return addr.address;
          }
        }
      }
    }

    // Se não encontrou nas prioritárias, procurar em todas as interfaces
    for (const ifaceName in interfaces) {
      const iface = interfaces[ifaceName];
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
            console.log(`✅ IP público detectado: ${addr.address} (interface: ${ifaceName})`);
            return addr.address;
          }
        }
      }
    }

    // Se não encontrou IP da rede, avisar o usuário
    console.warn('⚠️  Não foi possível determinar o IP público automaticamente.');
    console.warn('⚠️  Configure PUBLIC_URL ou PUBLIC_HOSTNAME no arquivo .env');
    console.warn('⚠️  Exemplo: PUBLIC_URL=http://192.168.1.100:3000');
    console.warn('⚠️  Ou: PUBLIC_HOSTNAME=192.168.1.100');
    console.warn('⚠️  Usando localhost como fallback (não será acessível externamente)');
    return 'localhost';
  }

  /**
   * Gera QR code como string base64 (Data URL)
   */
  static async generateQRCodeDataUrl(url: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Erro ao gerar QR code:', error);
      throw error;
    }
  }

  /**
   * Gera QR code como buffer (para salvar como arquivo)
   */
  static async generateQRCodeBuffer(url: string): Promise<Buffer> {
    try {
      const qrCodeBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrCodeBuffer;
    } catch (error) {
      console.error('Erro ao gerar QR code:', error);
      throw error;
    }
  }
}
