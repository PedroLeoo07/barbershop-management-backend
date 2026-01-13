import { database } from '../database';
import { 
  User, 
  CreateUserData, 
  UpdateUserData, 
  UserRole 
} from '../models';

export class UserRepository {
  /**
   * Buscar usuário por ID
   */
  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT 
        id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const result = await database.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Buscar usuário por email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT 
        id,
        name,
        email,
        phone,
        password,
        role,
        is_active,
        created_at,
        updated_at
      FROM users 
      WHERE email = $1 AND is_active = true
    `;
    
    const result = await database.query(query, [email]);
    return result.rows[0] || null;
  }

  /**
   * Buscar usuário por telefone
   */
  static async findByPhone(phone: string): Promise<User | null> {
    const query = `
      SELECT 
        id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      FROM users 
      WHERE phone = $1 AND is_active = true
    `;
    
    const result = await database.query(query, [phone]);
    return result.rows[0] || null;
  }

  /**
   * Criar novo usuário
   */
  static async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (name, email, phone, password, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
    `;
    
    const values = [
      userData.name,
      userData.email,
      userData.phone,
      userData.password,
      userData.role || UserRole.CLIENT
    ];
    
    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Atualizar usuário
   */
  static async update(id: string, userData: UpdateUserData): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(userData.name);
    }

    if (userData.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }

    if (userData.phone !== undefined) {
      fields.push(`phone = $${paramCount++}`);
      values.push(userData.phone);
    }

    if (userData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(userData.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount} AND is_active = true
      RETURNING 
        id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
    `;

    const result = await database.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Atualizar senha do usuário
   */
  static async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const query = `
      UPDATE users 
      SET password = $1, updated_at = NOW()
      WHERE id = $2 AND is_active = true
    `;
    
    const result = await database.query(query, [hashedPassword, id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Desativar usuário (soft delete)
   */
  static async softDelete(id: string): Promise<boolean> {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    
    const result = await database.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Listar usuários com paginação
   */
  static async findAll(params: {
    page: number;
    limit: number;
    role?: UserRole;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = ['is_active = true'];
    const values: any[] = [];
    let paramCount = 1;

    if (params.role) {
      conditions.push(`role = $${paramCount++}`);
      values.push(params.role);
    }

    if (params.search) {
      conditions.push(`(name ILIKE $${paramCount++} OR email ILIKE $${paramCount++})`);
      values.push(`%${params.search}%`, `%${params.search}%`);
    }

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users
      WHERE ${conditions.join(' AND ')}
    `;

    // Query para buscar usuários
    const usersQuery = `
      SELECT 
        id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(params.limit, offset);

    const [countResult, usersResult] = await Promise.all([
      database.query(countQuery, values.slice(0, -2)), // Remove limit e offset para count
      database.query(usersQuery, values)
    ]);

    return {
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Buscar clientes para dashboard
   */
  static async getClientStats(): Promise<{
    total_clients: number;
    new_clients_this_month: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE role = 'CLIENT') as total_clients,
        COUNT(*) FILTER (
          WHERE role = 'CLIENT' 
          AND created_at >= date_trunc('month', CURRENT_DATE)
        ) as new_clients_this_month
      FROM users 
      WHERE is_active = true
    `;

    const result = await database.query(query);
    return result.rows[0];
  }

  /**
   * Verificar se email já existe
   */
  static async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = `
      SELECT 1 FROM users 
      WHERE email = $1 AND is_active = true
    `;
    const values: any[] = [email];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await database.query(query, values);
    return result.rows.length > 0;
  }

  /**
   * Verificar se telefone já existe
   */
  static async phoneExists(phone: string, excludeId?: string): Promise<boolean> {
    let query = `
      SELECT 1 FROM users 
      WHERE phone = $1 AND is_active = true
    `;
    const values: any[] = [phone];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await database.query(query, values);
    return result.rows.length > 0;
  }
}