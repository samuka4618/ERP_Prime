import * as sql from 'mssql';
import { getSqlConnection } from '../../../config/sqlserver';

export interface CnpjQueryStatus {
  id: number;
  registration_id: number;
  cnpj: string;
  status: 'pending' | 'consulting_spc' | 'processing_tess' | 'consulting_cnpja' | 'saving_database' | 'registering_atak' | 'completed' | 'failed';
  current_step?: string;
  spc_status?: 'pending' | 'success' | 'failed';
  tess_status?: 'pending' | 'success' | 'failed';
  cnpja_status?: 'pending' | 'success' | 'failed';
  database_status?: 'pending' | 'success' | 'failed';
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCnpjQueryStatusRequest {
  registration_id: number;
  cnpj: string;
  status: 'pending' | 'consulting_spc' | 'processing_tess' | 'consulting_cnpja' | 'saving_database' | 'registering_atak' | 'completed' | 'failed';
  current_step?: string;
  error_message?: string;
}

export class CnpjQueryStatusModel {
  static async create(data: CreateCnpjQueryStatusRequest): Promise<CnpjQueryStatus> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('registration_id', sql.Int, data.registration_id);
    request.input('cnpj', sql.VarChar(18), data.cnpj);
    request.input('status', sql.VarChar(50), data.status);
    request.input('current_step', sql.NVarChar(255), data.current_step || null);
    request.input('error_message', sql.NVarChar(sql.MAX), data.error_message || null);

    const result = await request.query(`
      INSERT INTO cnpj_query_status (
        registration_id, cnpj, status, current_step, error_message
      )
      OUTPUT INSERTED.*
      VALUES (
        @registration_id, @cnpj, @status, @current_step, @error_message
      )
    `);

    return this.mapToCnpjQueryStatus(result.recordset[0]);
  }

  static async findByRegistrationId(registration_id: number): Promise<CnpjQueryStatus | null> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('registration_id', sql.Int, registration_id);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM cnpj_query_status
      WHERE registration_id = @registration_id
      ORDER BY updated_at DESC
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    return this.mapToCnpjQueryStatus(result.recordset[0]);
  }

  static async update(registration_id: number, updateData: Partial<CreateCnpjQueryStatusRequest>): Promise<void> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('registration_id', sql.Int, registration_id);
    
    const updates: string[] = [];
    
    if (updateData.status) {
      request.input('status', sql.VarChar(50), updateData.status);
      updates.push('status = @status');
    }
    
    if (updateData.current_step) {
      request.input('current_step', sql.NVarChar(255), updateData.current_step);
      updates.push('current_step = @current_step');
    }
    
    if (updateData.error_message !== undefined) {
      if (updateData.error_message === null || updateData.error_message === '') {
        updates.push('error_message = NULL');
      } else {
        request.input('error_message', sql.NVarChar(sql.MAX), updateData.error_message);
        updates.push('error_message = @error_message');
      }
    }

    if (updates.length === 0) {
      return;
    }

    updates.push('updated_at = GETDATE()');

    await request.query(`
      UPDATE cnpj_query_status
      SET ${updates.join(', ')}
      WHERE registration_id = @registration_id
    `);
  }

  static async updateStepStatus(
    registration_id: number,
    step: 'spc_status' | 'tess_status' | 'cnpja_status' | 'database_status',
    status: 'pending' | 'success' | 'failed'
  ): Promise<void> {
    const pool = await getSqlConnection();
    const request = new sql.Request(pool);
    
    request.input('registration_id', sql.Int, registration_id);
    request.input('status', sql.VarChar(50), status);

    await request.query(`
      UPDATE cnpj_query_status
      SET ${step} = @status, updated_at = GETDATE()
      WHERE registration_id = @registration_id
    `);
  }

  private static mapToCnpjQueryStatus(record: any): CnpjQueryStatus {
    return {
      id: record.id,
      registration_id: record.registration_id,
      cnpj: record.cnpj,
      status: record.status,
      current_step: record.current_step,
      spc_status: record.spc_status,
      tess_status: record.tess_status,
      cnpja_status: record.cnpja_status,
      database_status: record.database_status,
      error_message: record.error_message,
      created_at: new Date(record.created_at),
      updated_at: new Date(record.updated_at)
    };
  }
}

