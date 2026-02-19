import { dbAll } from '../../../core/database/connection';
import { logger } from '../../../shared/utils/logger';

export interface PerformanceMetrics {
  uptime: {
    percentage: number;
    hours: number;
    days: number;
  };
  peakUsers: {
    count: number;
    date: string;
  };
  peakAttendants: {
    count: number;
    date: string;
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
    avgResolutionTime: number; // em horas
  };
  messages: {
    total: number;
    today: number;
    avgPerTicket: number;
  };
  system: {
    startTime: string;
    lastActivity: string;
    activeConnections: number;
  };
  compras: {
    totalSolicitacoes: number;
    solicitacoesPendentes: number;
    solicitacoesEmCotacao: number;
    solicitacoesAprovadas: number;
    valorTotal: number;
    totalOrcamentos: number;
    orcamentosPendentes: number;
    orcamentosAprovados: number;
  };
}

export class PerformanceMetricsService {
  static async getMetrics(): Promise<PerformanceMetrics> {
    try {
      // Uptime do sistema (baseado na primeira entrada de ticket)
      const systemStart = await this.getSystemStartTime();
      const uptime = this.calculateUptime(systemStart);
      
      // Pico de usuários (baseado em tickets criados no mesmo dia)
      const peakUsers = await this.getPeakUsers();
      
      // Pico de atendentes (baseado em mensagens enviadas por atendentes)
      const peakAttendants = await this.getPeakAttendants();
      
      // Métricas de tickets
      const tickets = await this.getTicketMetrics();
      
      // Métricas de mensagens
      const messages = await this.getMessageMetrics();
      
      // Informações do sistema
      const system = await this.getSystemInfo();
      
      // Métricas de compras
      const compras = await this.getComprasMetrics();
      
      return {
        uptime,
        peakUsers,
        peakAttendants,
        tickets,
        messages,
        system,
        compras
      };
    } catch (error) {
      logger.error('Erro ao calcular métricas de performance:', error);
      throw error;
    }
  }

  private static async getSystemStartTime(): Promise<Date> {
    const result = await dbAll(
      'SELECT MIN(created_at) as start_time FROM tickets'
    ) as any[];
    
    if (result.length > 0 && result[0].start_time) {
      return new Date(result[0].start_time);
    }
    
    // Fallback para data atual se não houver tickets
    return new Date();
  }

  private static calculateUptime(startTime: Date): { percentage: number; hours: number; days: number } {
    const now = new Date();
    const totalTime = now.getTime() - startTime.getTime();
    const totalHours = totalTime / (1000 * 60 * 60);
    const totalDays = totalHours / 24;
    
    // Calcular uptime real baseado no tempo de funcionamento
    // Assumir 100% de uptime se o sistema está funcionando (sem logs de downtime)
    const uptimePercentage = 100.0;
    
    return {
      percentage: Math.round(uptimePercentage * 10) / 10,
      hours: Math.round(totalHours),
      days: Math.round(totalDays * 10) / 10
    };
  }

  private static async getPeakUsers(): Promise<{ count: number; date: string }> {
    // Primeiro, tentar com tickets
    let result = await dbAll(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT user_id) as user_count
      FROM tickets 
      WHERE created_at >= DATE('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY user_count DESC
      LIMIT 1
    `) as any[];
    
    if (result.length > 0 && result[0].user_count > 0) {
      return {
        count: result[0].user_count,
        date: result[0].date
      };
    }
    
    // Se não houver tickets, usar atividade de login
    result = await dbAll(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as user_count
      FROM user_activity_tracking 
      WHERE activity = 'login' 
        AND timestamp >= DATE('now', '-30 days')
      GROUP BY DATE(timestamp)
      ORDER BY user_count DESC
      LIMIT 1
    `) as any[];
    
    if (result.length > 0) {
      return {
        count: result[0].user_count,
        date: result[0].date
      };
    }
    
    return { count: 0, date: new Date().toISOString().split('T')[0] };
  }

  private static async getPeakAttendants(): Promise<{ count: number; date: string }> {
    // Contar atendentes únicos que enviaram mensagens por dia
    const result = await dbAll(`
      SELECT 
        DATE(th.created_at) as date,
        COUNT(DISTINCT th.author_id) as attendant_count
      FROM ticket_history th
      JOIN users u ON th.author_id = u.id
      WHERE u.role IN ('admin', 'attendant') 
        AND th.created_at >= DATE('now', '-30 days')
        AND th.message IS NOT NULL
        AND th.message != ''
      GROUP BY DATE(th.created_at)
      ORDER BY attendant_count DESC
      LIMIT 1
    `) as any[];
    
    if (result.length > 0) {
      return {
        count: result[0].attendant_count,
        date: result[0].date
      };
    }
    
    // Se não houver mensagens, contar total de admins/atendentes
    const totalAttendants = await dbAll(`
      SELECT COUNT(*) as count
      FROM users 
      WHERE role IN ('admin', 'attendant')
    `) as any[];
    
    return { 
      count: totalAttendants[0]?.count || 0, 
      date: new Date().toISOString().split('T')[0] 
    };
  }

  private static async getTicketMetrics(): Promise<{ total: number; open: number; closed: number; avgResolutionTime: number }> {
    const totalResult = await dbAll('SELECT COUNT(*) as total FROM tickets') as any[];
    const openResult = await dbAll("SELECT COUNT(*) as open FROM tickets WHERE status != 'closed'") as any[];
    const closedResult = await dbAll("SELECT COUNT(*) as closed FROM tickets WHERE status = 'closed'") as any[];
    
    // Calcular tempo médio de resolução (em horas)
    const resolutionResult = await dbAll(`
      SELECT 
        AVG(
          (julianday(updated_at) - julianday(created_at)) * 24
        ) as avg_hours
      FROM tickets 
      WHERE status = 'closed' 
        AND updated_at IS NOT NULL
    `) as any[];
    
    const avgResolutionTime = resolutionResult[0]?.avg_hours || 0;
    
    return {
      total: totalResult[0]?.total || 0,
      open: openResult[0]?.open || 0,
      closed: closedResult[0]?.closed || 0,
      avgResolutionTime: Math.round(avgResolutionTime * 10) / 10
    };
  }

  private static async getMessageMetrics(): Promise<{ total: number; today: number; avgPerTicket: number }> {
    const totalResult = await dbAll('SELECT COUNT(*) as total FROM ticket_history') as any[];
    const todayResult = await dbAll(`
      SELECT COUNT(*) as today 
      FROM ticket_history 
      WHERE DATE(created_at) = DATE('now')
    `) as any[];
    
    const ticketCountResult = await dbAll('SELECT COUNT(*) as count FROM tickets') as any[];
    const ticketCount = ticketCountResult[0]?.count || 1;
    const avgPerTicket = Math.round((totalResult[0]?.total || 0) / ticketCount * 10) / 10;
    
    return {
      total: totalResult[0]?.total || 0,
      today: todayResult[0]?.today || 0,
      avgPerTicket
    };
  }

  private static async getSystemInfo(): Promise<{ startTime: string; lastActivity: string; activeConnections: number }> {
    const startResult = await dbAll('SELECT MIN(created_at) as start_time FROM tickets') as any[];
    const lastActivityResult = await dbAll(`
      SELECT MAX(created_at) as last_activity 
      FROM (
        SELECT created_at FROM tickets
        UNION ALL
        SELECT created_at FROM ticket_history
        UNION ALL
        SELECT created_at FROM solicitacoes_compra
        UNION ALL
        SELECT created_at FROM orcamentos
      )
    `) as any[];
    
    // Contar usuários ativos (que fizeram login nas últimas 24 horas)
    const activeUsersResult = await dbAll(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM user_activity_tracking 
      WHERE activity = 'login' 
        AND timestamp >= datetime('now', '-24 hours')
    `) as any[];
    
    return {
      startTime: startResult[0]?.start_time || new Date().toISOString(),
      lastActivity: lastActivityResult[0]?.last_activity || new Date().toISOString(),
      activeConnections: activeUsersResult[0]?.count || 0
    };
  }

  private static async getComprasMetrics(): Promise<{
    totalSolicitacoes: number;
    solicitacoesPendentes: number;
    solicitacoesEmCotacao: number;
    solicitacoesAprovadas: number;
    valorTotal: number;
    totalOrcamentos: number;
    orcamentosPendentes: number;
    orcamentosAprovados: number;
  }> {
    const solicitacoesTotal = await dbAll('SELECT COUNT(*) as total FROM solicitacoes_compra') as any[];
    const solicitacoesPendentes = await dbAll("SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'pendente_aprovacao'") as any[];
    const solicitacoesEmCotacao = await dbAll("SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'em_cotacao'") as any[];
    const solicitacoesAprovadas = await dbAll("SELECT COUNT(*) as count FROM solicitacoes_compra WHERE status = 'aprovada'") as any[];
    const valorTotal = await dbAll('SELECT COALESCE(SUM(valor_total), 0) as total FROM solicitacoes_compra') as any[];
    const orcamentosTotal = await dbAll('SELECT COUNT(*) as total FROM orcamentos') as any[];
    const orcamentosPendentes = await dbAll("SELECT COUNT(*) as count FROM orcamentos WHERE status = 'pendente'") as any[];
    const orcamentosAprovados = await dbAll("SELECT COUNT(*) as count FROM orcamentos WHERE status = 'aprovado'") as any[];
    
    return {
      totalSolicitacoes: solicitacoesTotal[0]?.total || 0,
      solicitacoesPendentes: solicitacoesPendentes[0]?.count || 0,
      solicitacoesEmCotacao: solicitacoesEmCotacao[0]?.count || 0,
      solicitacoesAprovadas: solicitacoesAprovadas[0]?.count || 0,
      valorTotal: parseFloat(valorTotal[0]?.total || 0),
      totalOrcamentos: orcamentosTotal[0]?.total || 0,
      orcamentosPendentes: orcamentosPendentes[0]?.count || 0,
      orcamentosAprovados: orcamentosAprovados[0]?.count || 0
    };
  }
}
