import { dbRun, dbGet, dbAll } from '../database/connection';

export interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RolePermission {
  id: number;
  role: 'user' | 'attendant' | 'admin';
  permission_id: number;
  granted: boolean;
  created_at: Date;
}

export interface UserPermission {
  id: number;
  user_id: number;
  permission_id: number;
  granted: boolean;
  created_at: Date;
}

export interface PermissionWithStatus extends Permission {
  granted: boolean;
  source: 'role' | 'user' | 'default';
}

export class PermissionModel {
  /**
   * Buscar todas as permissões
   */
  static async findAll(): Promise<Permission[]> {
    const permissions = await dbAll(
      'SELECT * FROM permissions ORDER BY module, name'
    ) as any[];

    return permissions.map(p => ({
      ...p,
      created_at: new Date(p.created_at),
      updated_at: new Date(p.updated_at)
    }));
  }

  /**
   * Buscar permissão por ID
   */
  static async findById(id: number): Promise<Permission | null> {
    const permission = await dbGet(
      'SELECT * FROM permissions WHERE id = ?',
      [id]
    ) as any;

    if (!permission) {
      return null;
    }

    return {
      ...permission,
      created_at: new Date(permission.created_at),
      updated_at: new Date(permission.updated_at)
    };
  }

  /**
   * Buscar permissão por código
   */
  static async findByCode(code: string): Promise<Permission | null> {
    const permission = await dbGet(
      'SELECT * FROM permissions WHERE code = ?',
      [code]
    ) as any;

    if (!permission) {
      return null;
    }

    return {
      ...permission,
      created_at: new Date(permission.created_at),
      updated_at: new Date(permission.updated_at)
    };
  }

  /**
   * Buscar permissões por módulo
   */
  static async findByModule(module: string): Promise<Permission[]> {
    const permissions = await dbAll(
      'SELECT * FROM permissions WHERE module = ? ORDER BY name',
      [module]
    ) as any[];

    return permissions.map(p => ({
      ...p,
      created_at: new Date(p.created_at),
      updated_at: new Date(p.updated_at)
    }));
  }

  /**
   * Buscar permissões de um role
   */
  static async findByRole(role: 'user' | 'attendant' | 'admin'): Promise<RolePermission[]> {
    const rolePermissions = await dbAll(
      'SELECT * FROM role_permissions WHERE role = ?',
      [role]
    ) as any[];

    return rolePermissions.map(rp => ({
      ...rp,
      granted: Boolean(rp.granted),
      created_at: new Date(rp.created_at)
    }));
  }

  /**
   * Buscar permissões de um usuário (incluindo role e permissões individuais)
   * Para admins: retorna TODAS as permissões do sistema, não apenas as do role
   */
  static async findByUser(userId: number, userRole: string): Promise<PermissionWithStatus[]> {
    // Buscar TODAS as permissões do sistema
    const allPermissions = await dbAll(
      'SELECT * FROM permissions ORDER BY module, name'
    ) as any[];

    // Buscar permissões do role (para determinar o valor padrão)
    const rolePermissions = await dbAll(
      `SELECT permission_id, granted FROM role_permissions WHERE role = ?`,
      [userRole]
    ) as any[];

    // Criar mapa de permissões do role para consulta rápida
    const rolePermsMap = new Map<number, boolean>();
    rolePermissions.forEach(rp => {
      rolePermsMap.set(rp.permission_id, rp.granted === 1 || rp.granted === true || rp.granted === '1');
    });

    // Buscar permissões individuais do usuário (sobrescrevem as do role)
    const userPermissions = await dbAll(
      `SELECT permission_id, granted FROM user_permissions WHERE user_id = ?`,
      [userId]
    ) as any[];

    // Criar mapa de permissões individuais do usuário
    const userPermsMap = new Map<number, boolean>();
    userPermissions.forEach(up => {
      // Converter para boolean explicitamente
      const granted = up.granted === 1 || up.granted === true || up.granted === '1' || up.granted === 1;
      userPermsMap.set(up.permission_id, granted);
    });

    // Construir resultado: todas as permissões do sistema
    const result: PermissionWithStatus[] = allPermissions.map(perm => {
      // Se há permissão individual, ela prevalece
      if (userPermsMap.has(perm.id)) {
        const granted = userPermsMap.get(perm.id)!;
        console.log(`[findByUser] Permissão ${perm.id} (${perm.code}): individual do usuário, granted=${granted}`);
        return {
          id: perm.id,
          name: perm.name,
          code: perm.code,
          module: perm.module,
          description: perm.description,
          granted,
          source: 'user',
          created_at: new Date(perm.created_at),
          updated_at: new Date(perm.updated_at)
        };
      }

      // Se não há permissão individual, usar o valor do role
      // Para admin, se não há permissão no role_permissions, assume true (admin tem tudo por padrão)
      let granted = false;
      if (userRole === 'admin') {
        granted = rolePermsMap.has(perm.id) ? rolePermsMap.get(perm.id)! : true;
      } else {
        granted = rolePermsMap.get(perm.id) || false;
      }
      
      console.log(`[findByUser] Permissão ${perm.id} (${perm.code}): do role ${userRole}, granted=${granted}`);

      return {
        id: perm.id,
        name: perm.name,
        code: perm.code,
        module: perm.module,
        description: perm.description,
        granted,
        source: 'role',
        created_at: new Date(perm.created_at),
        updated_at: new Date(perm.updated_at)
      };
    });

    return result;
  }

  /**
   * Verificar se usuário tem permissão
   * Prioridade: Permissão individual do usuário > Permissão do role
   * Para admins: se houver permissão individual negada, ela sobrescreve o comportamento padrão
   */
  static async hasPermission(
    userId: number,
    userRole: string,
    permissionCode: string
  ): Promise<boolean> {
    // Buscar permissão por código
    const permission = await this.findByCode(permissionCode);
    if (!permission) {
      return false;
    }

    // Verificar permissão individual do usuário PRIMEIRO (sobrescreve role, incluindo admin)
    const userPermission = await dbGet(
      'SELECT granted FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, permission.id]
    ) as any;

    if (userPermission !== undefined) {
      // Se há permissão individual, ela sempre prevalece (mesmo para admin)
      return userPermission.granted === 1 || userPermission.granted === true || userPermission.granted === '1';
    }

    // Se não há permissão individual, verificar permissão do role
    // Admin tem todas as permissões por padrão (se não houver permissão individual)
    if (userRole === 'admin') {
      return true;
    }

    const rolePermission = await dbGet(
      'SELECT granted FROM role_permissions WHERE role = ? AND permission_id = ?',
      [userRole, permission.id]
    ) as any;

    return rolePermission ? (rolePermission.granted === 1 || rolePermission.granted === true || rolePermission.granted === '1') : false;
  }

  /**
   * Atualizar permissão de role
   */
  static async updateRolePermission(
    role: string,
    permissionId: number,
    granted: boolean
  ): Promise<void> {
    await dbRun(
      `INSERT INTO role_permissions (role, permission_id, granted)
       VALUES (?, ?, ?)
       ON CONFLICT(role, permission_id) DO UPDATE SET granted = ?`,
      [role, permissionId, granted ? 1 : 0, granted ? 1 : 0]
    );
  }

  /**
   * Atualizar permissão de usuário
   */
  static async updateUserPermission(
    userId: number,
    permissionId: number,
    granted: boolean
  ): Promise<void> {
    // Garantir que granted é um boolean
    const grantedValue = granted === true ? 1 : 0;
    
    console.log(`[updateUserPermission] Salvando permissão: userId=${userId}, permissionId=${permissionId}, granted=${granted} (valor no DB: ${grantedValue})`);
    
    await dbRun(
      `INSERT INTO user_permissions (user_id, permission_id, granted)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, permission_id) DO UPDATE SET granted = ?`,
      [userId, permissionId, grantedValue, grantedValue]
    );
    
    // Verificar se foi salvo corretamente
    const saved = await dbGet(
      'SELECT granted FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, permissionId]
    ) as any;
    
    console.log(`[updateUserPermission] Verificação após salvar: granted=${saved?.granted}, tipo=${typeof saved?.granted}`);
  }

  /**
   * Remover permissão de usuário
   */
  static async removeUserPermission(userId: number, permissionId: number): Promise<void> {
    await dbRun(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?',
      [userId, permissionId]
    );
  }

  /**
   * Criar nova permissão
   */
  static async create(permission: {
    name: string;
    code: string;
    module: string;
    description?: string;
  }): Promise<Permission> {
    const result = await dbRun(
      `INSERT INTO permissions (name, code, module, description)
       VALUES (?, ?, ?, ?)`,
      [permission.name, permission.code, permission.module, permission.description || null]
    );

    const newPermission = await this.findById(result.lastID);
    if (!newPermission) {
      throw new Error('Erro ao criar permissão');
    }

    return newPermission;
  }

  /**
   * Atualizar permissão
   */
  static async update(id: number, updates: {
    name?: string;
    code?: string;
    module?: string;
    description?: string;
  }): Promise<Permission> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.code !== undefined) {
      fields.push('code = ?');
      values.push(updates.code);
    }
    if (updates.module !== undefined) {
      fields.push('module = ?');
      values.push(updates.module);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }

    if (fields.length === 0) {
      const permission = await this.findById(id);
      if (!permission) {
        throw new Error('Permissão não encontrada');
      }
      return permission;
    }

    values.push(id);
    await dbRun(
      `UPDATE permissions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const updatedPermission = await this.findById(id);
    if (!updatedPermission) {
      throw new Error('Erro ao atualizar permissão');
    }

    return updatedPermission;
  }

  /**
   * Excluir permissão
   */
  static async delete(id: number): Promise<void> {
    await dbRun('DELETE FROM permissions WHERE id = ?', [id]);
  }
}

