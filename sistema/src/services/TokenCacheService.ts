import { logger } from '../utils/logger';

interface ActiveToken {
  userId: number;
  userRole: string;
  userName: string;
  userEmail: string;
  lastSeen: Date;
  isActive: boolean;
}

class TokenCacheService {
  private activeTokens: Map<string, ActiveToken> = new Map();
  private invalidatedTokens: Set<string> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Limpar tokens inativos a cada 2 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveTokens();
    }, 120000); // 2 minutos
  }

  // Adicionar/atualizar token ativo
  addActiveToken(token: string, userInfo: {
    userId: number;
    userRole: string;
    userName: string;
    userEmail: string;
  }): void {
    this.activeTokens.set(token, {
      ...userInfo,
      lastSeen: new Date(),
      isActive: true
    });
    
    logger.debug(`Token ativo adicionado para usuário ${userInfo.userName} (ID: ${userInfo.userId})`);
  }

  // Verificar se token está ativo
  isTokenActive(token: string): boolean {
    // Primeiro verificar se o token foi invalidado
    if (this.invalidatedTokens.has(token)) {
      console.log(`Token invalidado detectado: ${token.substring(0, 20)}...`);
      return false;
    }

    const tokenInfo = this.activeTokens.get(token);
    if (!tokenInfo) {
      console.log(`Token não encontrado no cache: ${token.substring(0, 20)}...`);
      return false;
    }

    // Verificar se o token não expirou (última atividade há menos de 5 minutos)
    const now = new Date();
    const timeDiff = now.getTime() - tokenInfo.lastSeen.getTime();
    const isRecent = timeDiff < 5 * 60 * 1000; // 5 minutos

    if (!isRecent) {
      this.activeTokens.delete(token);
      console.log(`Token expirado removido: ${token.substring(0, 20)}...`);
      return false;
    }

    // Atualizar última atividade
    tokenInfo.lastSeen = now;
    console.log(`Token ativo: ${token.substring(0, 20)}... para ${tokenInfo.userName}`);
    return true;
  }

  // Invalidar token (adicionar à lista de tokens inválidos)
  invalidateToken(token: string): void {
    this.invalidatedTokens.add(token);
    logger.debug(`Token invalidado: ${token.substring(0, 20)}...`);
  }

  // Verificar se token foi invalidado
  isTokenInvalidated(token: string): boolean {
    return this.invalidatedTokens.has(token);
  }

  // Obter informações do usuário pelo token
  getUserByToken(token: string): ActiveToken | null {
    const tokenInfo = this.activeTokens.get(token);
    if (!tokenInfo || !this.isTokenActive(token)) {
      return null;
    }
    return tokenInfo;
  }

  // Remover token (logout)
  removeToken(token: string): void {
    const tokenInfo = this.activeTokens.get(token);
    if (tokenInfo) {
      logger.debug(`Token removido para usuário ${tokenInfo.userName} (ID: ${tokenInfo.userId})`);
      this.activeTokens.delete(token);
    } else {
      logger.warn(`Tentativa de remover token não encontrado no cache`);
    }
  }

  // Remover todos os tokens de um usuário específico (logout por userId)
  removeUserTokens(userId: number): void {
    const tokensToRemove: string[] = [];
    
    // Encontrar todos os tokens do usuário
    for (const [token, tokenInfo] of this.activeTokens) {
      if (tokenInfo.userId === userId) {
        tokensToRemove.push(token);
      }
    }
    
    // Remover todos os tokens do usuário
    tokensToRemove.forEach(token => {
      const tokenInfo = this.activeTokens.get(token);
      if (tokenInfo) {
        logger.debug(`Token removido para usuário ${tokenInfo.userName} (ID: ${tokenInfo.userId})`);
        this.activeTokens.delete(token);
        // Também invalidar o token para evitar reuso
        this.invalidateToken(token);
      }
    });
    
    if (tokensToRemove.length > 0) {
      logger.info(`${tokensToRemove.length} tokens removidos para usuário ID ${userId}`);
    } else {
      logger.warn(`Nenhum token encontrado para usuário ID ${userId}`);
    }
  }

  // Obter todos os usuários online
  getOnlineUsers(): ActiveToken[] {
    const now = new Date();
    const onlineUsers: ActiveToken[] = [];

    for (const [token, tokenInfo] of this.activeTokens) {
      const timeDiff = now.getTime() - tokenInfo.lastSeen.getTime();
      if (timeDiff < 5 * 60 * 1000) { // 5 minutos
        onlineUsers.push(tokenInfo);
      }
    }

    return onlineUsers;
  }

  // Obter usuários online por role
  getOnlineUsersByRole(role: string): ActiveToken[] {
    return this.getOnlineUsers().filter(user => user.userRole === role);
  }

  // Obter estatísticas de usuários online
  getOnlineStats(): {
    total: number;
    byRole: Record<string, number>;
    users: ActiveToken[];
  } {
    const onlineUsers = this.getOnlineUsers();
    const byRole: Record<string, number> = {};

    onlineUsers.forEach(user => {
      byRole[user.userRole] = (byRole[user.userRole] || 0) + 1;
    });

    return {
      total: onlineUsers.length,
      byRole,
      users: onlineUsers
    };
  }

  // Limpar tokens inativos
  private cleanupInactiveTokens(): void {
    const now = new Date();
    const inactiveTokens: string[] = [];

    for (const [token, tokenInfo] of this.activeTokens) {
      const timeDiff = now.getTime() - tokenInfo.lastSeen.getTime();
      if (timeDiff >= 5 * 60 * 1000) { // 5 minutos
        inactiveTokens.push(token);
      }
    }

    inactiveTokens.forEach(token => {
      this.activeTokens.delete(token);
    });

    if (inactiveTokens.length > 0) {
      logger.info(`${inactiveTokens.length} tokens inativos removidos`);
    }
  }

  // Obter estatísticas do cache
  getCacheStats(): {
    totalTokens: number;
    activeTokens: number;
    memoryUsage: number;
  } {
    const now = new Date();
    let activeCount = 0;

    for (const tokenInfo of this.activeTokens.values()) {
      const timeDiff = now.getTime() - tokenInfo.lastSeen.getTime();
      if (timeDiff < 5 * 60 * 1000) {
        activeCount++;
      }
    }

    return {
      totalTokens: this.activeTokens.size,
      activeTokens: activeCount,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  // Destruir serviço
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.activeTokens.clear();
  }

  // Método para debug - limpar cache completamente
  clearAllTokens(): void {
    const count = this.activeTokens.size;
    this.activeTokens.clear();
    logger.info(`Cache limpo completamente - ${count} tokens removidos`);
  }

  // Método para debug - listar todos os tokens
  listAllTokens(): void {
    logger.info(`=== CACHE DE TOKENS (${this.activeTokens.size} tokens) ===`);
    this.activeTokens.forEach((tokenInfo, token) => {
      logger.info(`Token: ${token.substring(0, 20)}... | User: ${tokenInfo.userName} (${tokenInfo.userRole}) | Ativo: ${tokenInfo.isActive}`);
    });
    logger.info(`=== FIM CACHE ===`);
  }
}

export const tokenCacheService = new TokenCacheService();
export default tokenCacheService;
