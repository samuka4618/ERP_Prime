import QRCode from 'qrcode';
import { config } from '../../../config/database';
import os from 'os';

/**
 * Serviço para gerar QR codes de formulários publicados
 */
export class QRCodeService {
  /**
   * Gera URL pública do formulário.
   * Com túnel (API em um domínio, front no Railway): usar CLIENT_URL/FRONTEND_URL (onde o front está).
   * Sem túnel (front e back no mesmo servidor): usar PUBLIC_URL ou hostname.
   */
  static async getPublicFormUrl(formularioId: number): Promise<string> {
    const path = `/descarregamento/formulario/${formularioId}`;

    const satBase = (process.env.SATELLITE_PUBLIC_URL || process.env.SATELLITE_BASE_URL || '').trim();
    const satToken = (process.env.SATELLITE_AUTH_TOKEN || '').trim();
    if (satBase && satToken) {
      let base = satBase.replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(base)) {
        base = `https://${base}`;
      }
      return `${base}/d/fd-${formularioId}`;
    }

    // Quando o front está em outro domínio (ex.: Railway) e a API no túnel (api.ssnas.com.br),
    // o link do formulário deve abrir no front (Railway), não na API.
    const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || '').trim();
    if (clientUrl) {
      let base = clientUrl.replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(base)) {
        base = `https://${base}`;
      }
      return `${base}${path}`;
    }

    // PUBLIC_URL (ex.: Cloudflare Tunnel) quando front e back estão no mesmo túnel
    if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.trim()) {
      const base = process.env.PUBLIC_URL.trim().replace(/\/+$/, '');
      if (/^https?:\/\//i.test(base)) {
        return `${base}${path}`;
      }
    }

    // Fallback: hostname + protocolo + porta (rede local ou produção sem túnel)
    const hostname = this.getPublicHostname();
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const port = process.env.NODE_ENV === 'production' ? '' : `:${config.port}`;
    
    return `${protocol}://${hostname}${port}${path}`;
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
