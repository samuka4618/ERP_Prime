import * as sql from 'mssql';
import { getSqlConnection, executeSqlQuery } from '../config/sqlserver';

export interface ClientRegistrationHistory {
  id: number;
  registration_id: number;
  user_id: number;
  user_name?: string;
  status_anterior?: string;
  status_novo: string;
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
  created_at: Date;
}

export interface CreateClientRegistrationHistoryRequest {
  registration_id: number;
  user_id: number;
  status_anterior?: string;
  status_novo: string;
  observacoes?: string;
  prazo_aprovado?: string;
  limite_aprovado?: string;
}

export class ClientRegistrationHistoryModel {
  static async create(data: CreateClientRegistrationHistoryRequest): Promise<ClientRegistrationHistory> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('registration_id', sql.Int, data.registration_id);
    request.input('user_id', sql.Int, data.user_id);
    request.input('status_anterior', sql.VarChar(50), data.status_anterior || null);
    request.input('status_novo', sql.VarChar(50), data.status_novo);
    request.input('observacoes', sql.NVarChar(sql.MAX), data.observacoes || null);
    request.input('prazo_aprovado', sql.NVarChar(50), data.prazo_aprovado || null);
    request.input('limite_aprovado', sql.NVarChar(50), data.limite_aprovado || null);

    const result = await request.query(`
      INSERT INTO client_registration_history (
        registration_id, user_id, status_anterior, status_novo,
        observacoes, prazo_aprovado, limite_aprovado
      )
      OUTPUT INSERTED.*
      VALUES (
        @registration_id, @user_id, @status_anterior, @status_novo,
        @observacoes, @prazo_aprovado, @limite_aprovado
      )
    `);

    return this.mapToHistory(result.recordset[0]);
  }

  static async findByRegistrationId(registrationId: number): Promise<ClientRegistrationHistory[]> {
    const result = await executeSqlQuery(`
      SELECT 
        h.*,
        u.name as user_name
      FROM client_registration_history h
      LEFT JOIN (
        -- Consulta híbrida: buscar nome do usuário no SQLite
        SELECT 
          CAST(id AS VARCHAR) as id,
          name
        FROM OPENROWSET('SQLNCLI', 'Server=localhost;Database=chamados;Trusted_Connection=yes;', 
          'SELECT id, name FROM users')
      ) u ON CAST(h.user_id AS VARCHAR) = u.id
      WHERE h.registration_id = @registrationId
      ORDER BY h.created_at DESC
    `, { registrationId });

    return result.map(row => this.mapToHistory(row));
  }

  static async findByUserId(userId: number): Promise<ClientRegistrationHistory[]> {
    const result = await executeSqlQuery(`
      SELECT 
        h.*,
        u.name as user_name
      FROM client_registration_history h
      LEFT JOIN (
          -- Consulta híbrida: buscar nome do usuário no SQLite
          SELECT 
            CAST(id AS VARCHAR) as id,
            name
          FROM OPENROWSET('SQLNCLI', 'Server=localhost;Database=chamados;Trusted_Connection=yes;', 
            'SELECT id, name FROM users')
        ) u ON CAST(h.user_id AS VARCHAR) = u.id
      WHERE h.user_id = @userId
      ORDER BY h.created_at DESC
    `, { userId });

    return result.map(row => this.mapToHistory(row));
  }

  static async getRecentHistory(limit: number = 10): Promise<ClientRegistrationHistory[]> {
    const result = await executeSqlQuery(`
      SELECT 
        h.*,
        u.name as user_name
      FROM client_registration_history h
      LEFT JOIN (
          -- Consulta híbrida: buscar nome do usuário no SQLite
          SELECT 
            CAST(id AS VARCHAR) as id,
            name
          FROM OPENROWSET('SQLNCLI', 'Server=localhost;Database=chamados;Trusted_Connection=yes;', 
            'SELECT id, name FROM users')
        ) u ON CAST(h.user_id AS VARCHAR) = u.id
      ORDER BY h.created_at DESC
      OFFSET 0 ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { limit });

    return result.map(row => this.mapToHistory(row));
  }

  static async getStatusChangesByDateRange(
    startDate: Date, 
    endDate: Date
  ): Promise<ClientRegistrationHistory[]> {
    const result = await executeSqlQuery(`
      SELECT 
        h.*,
        u.name as user_name
      FROM client_registration_history h
      LEFT JOIN (
          -- Consulta híbrida: buscar nome do usuário no SQLite
          SELECT 
            CAST(id AS VARCHAR) as id,
            name
          FROM OPENROWSET('SQLNCLI', 'Server=localhost;Database=chamados;Trusted_Connection=yes;', 
            'SELECT id, name FROM users')
        ) u ON CAST(h.user_id AS VARCHAR) = u.id
      WHERE h.created_at BETWEEN @startDate AND @endDate
      ORDER BY h.created_at DESC
    `, { startDate, endDate });

    return result.map(row => this.mapToHistory(row));
  }

  static async getStatusStatistics(): Promise<{
    total_changes: number;
    status_changes: Record<string, number>;
    changes_by_user: Array<{ user_id: number; user_name: string; count: number }>;
  }> {
    const totalResult = await executeSqlQuery(`
      SELECT COUNT(*) as total_changes
      FROM client_registration_history
    `);

    const statusResult = await executeSqlQuery(`
      SELECT 
        status_novo,
        COUNT(*) as count
      FROM client_registration_history
      GROUP BY status_novo
    `);

    const userResult = await executeSqlQuery(`
      SELECT 
        h.user_id,
        u.name as user_name,
        COUNT(*) as count
      FROM client_registration_history h
      LEFT JOIN (
          -- Consulta híbrida: buscar nome do usuário no SQLite
          SELECT 
            CAST(id AS VARCHAR) as id,
            name
          FROM OPENROWSET('SQLNCLI', 'Server=localhost;Database=chamados;Trusted_Connection=yes;', 
            'SELECT id, name FROM users')
        ) u ON CAST(h.user_id AS VARCHAR) = u.id
      GROUP BY h.user_id, u.name
      ORDER BY count DESC
    `);

    const status_changes: Record<string, number> = {};
    statusResult.forEach(row => {
      status_changes[row.status_novo] = row.count;
    });

    const changes_by_user = userResult.map(row => ({
      user_id: row.user_id,
      user_name: row.user_name || 'Usuário não encontrado',
      count: row.count
    }));

    return {
      total_changes: totalResult[0].total_changes,
      status_changes,
      changes_by_user
    };
  }

  private static mapToHistory(row: any): ClientRegistrationHistory {
    return {
      id: row.id,
      registration_id: row.registration_id,
      user_id: row.user_id,
      user_name: row.user_name,
      status_anterior: row.status_anterior,
      status_novo: row.status_novo,
      observacoes: row.observacoes,
      prazo_aprovado: row.prazo_aprovado,
      limite_aprovado: row.limite_aprovado,
      created_at: new Date(row.created_at)
    };
  }
}
