import axios from 'axios';

/**
 * Serviço para detectar e obter URL pública do ngrok
 * 
 * O ngrok cria túneis seguros para expor servidores locais à internet.
 * Este serviço detecta automaticamente se o ngrok está rodando e obtém a URL pública.
 * 
 * SEGURANÇA:
 * - O ngrok usa criptografia de ponta a ponta
 * - Versão gratuita: URLs temporárias (mudam a cada reinício)
 * - Versão paga: URLs fixas e mais recursos
 * - Recomendado para desenvolvimento/testes
 * - Para produção: considere usar domínio próprio com SSL
 */
export class NgrokService {
  private static cachedUrl: string | null = null;
  private static lastCheck: number = 0;
  private static readonly CACHE_DURATION = 30000; // 30 segundos

  /**
   * Verifica se o ngrok está rodando e obtém a URL pública
   */
  static async getNgrokUrl(): Promise<string | null> {
    try {
      // Verificar cache primeiro
      const now = Date.now();
      if (this.cachedUrl && (now - this.lastCheck) < this.CACHE_DURATION) {
        return this.cachedUrl;
      }

      // Tentar obter URL do ngrok via API local
      // O ngrok expõe uma API local em http://127.0.0.1:4040/api/tunnels
      const response = await axios.get('http://127.0.0.1:4040/api/tunnels', {
        timeout: 2000 // Timeout curto para não travar se ngrok não estiver rodando
      });

      if (response.data && response.data.tunnels && response.data.tunnels.length > 0) {
        // Pegar o primeiro túnel HTTP/HTTPS
        const httpTunnel = response.data.tunnels.find((tunnel: any) => 
          tunnel.proto === 'https' || tunnel.proto === 'http'
        );

        if (httpTunnel && httpTunnel.public_url) {
          this.cachedUrl = httpTunnel.public_url;
          this.lastCheck = now;
          console.log(`✅ URL do ngrok detectada: ${this.cachedUrl}`);
          return this.cachedUrl;
        }
      }

      return null;
    } catch (error: any) {
      // Se ngrok não estiver rodando, retornar null silenciosamente
      // Não logar erro para não poluir os logs
      return null;
    }
  }

  /**
   * Verifica se o ngrok está ativo
   */
  static async isActive(): Promise<boolean> {
    const url = await this.getNgrokUrl();
    return url !== null;
  }

  /**
   * Limpa o cache (útil quando ngrok reinicia)
   */
  static clearCache(): void {
    this.cachedUrl = null;
    this.lastCheck = 0;
  }
}
