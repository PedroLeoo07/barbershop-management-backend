// =====================================================
// REPOSITORY DE USUÁRIOS
// =====================================================

const { BaseRepository } = require('./BaseRepository');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

class UserRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'users';
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS DE USUÁRIOS
  // =====================================================

  /**
   * Busca usuário por email
   */
  async findByEmail(email, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      return result.rows[0] || null;
    } catch (error) {
      Logger.error('Error finding user by email', { email, error });
      throw error;
    }
  }

  /**
   * Busca usuário por telefone
   */
  async findByPhone(phone, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        'SELECT * FROM users WHERE phone = $1',
        [phone]
      );

      return result.rows[0] || null;
    } catch (error) {
      Logger.error('Error finding user by phone', { phone, error });
      throw error;
    }
  }

  /**
   * Busca usuários por role
   */
  async findByRole(role, options = {}, client = null) {
    try {
      const {
        limit = 50,
        offset = 0,
        includeInactive = false,
        orderBy = 'name'
      } = options;

      const queryClient = client || this.db;
      
      let query = 'SELECT * FROM users WHERE role = $1';
      const params = [role];

      if (!includeInactive) {
        query += ' AND is_active = $2';
        params.push(true);
      }

      query += ` ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await queryClient.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding users by role', { role, error });
      throw error;
    }
  }

  /**
   * Busca barbeiros ativos
   */
  async findActiveBarbers(client = null) {
    return await this.findByRole('barber', { includeInactive: false }, client);
  }

  /**
   * Busca clientes ativos
   */
  async findActiveClients(options = {}, client = null) {
    return await this.findByRole('client', { includeInactive: false, ...options }, client);
  }

  /**
   * Cria usuário com validações
   */
  async createUser(userData, client = null) {
    const {
      name,
      email,
      phone,
      password_hash,
      role = 'client',
      is_active = true
    } = userData;

    return await this.withTransaction(async (transactionClient) => {
      // Verifica se email já existe
      const existingEmail = await this.findByEmail(email, transactionClient);
      if (existingEmail) {
        throw AppError.conflict('Email já está em uso');
      }

      // Verifica se telefone já existe
      if (phone) {
        const existingPhone = await this.findByPhone(phone, transactionClient);
        if (existingPhone) {
          throw AppError.conflict('Telefone já está em uso');
        }
      }

      // Cria o usuário
      const user = await this.create({
        name,
        email,
        phone,
        password_hash,
        role,
        is_active
      }, transactionClient);

      Logger.database('User created', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return user;
    });
  }

  /**
   * Atualiza senha do usuário
   */
  async updatePassword(userId, newPasswordHash, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `UPDATE users 
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, name, role`,
        [newPasswordHash, userId]
      );

      if (result.rows.length === 0) {
        throw AppError.notFound('Usuário não encontrado');
      }

      Logger.database('User password updated', { userId });
      return result.rows[0];

    } catch (error) {
      Logger.error('Error updating user password', { userId, error });
      throw error;
    }
  }

  /**
   * Ativa/desativa usuário
   */
  async setActiveStatus(userId, isActive, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `UPDATE users 
         SET is_active = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [isActive, userId]
      );

      if (result.rows.length === 0) {
        throw AppError.notFound('Usuário não encontrado');
      }

      Logger.database('User active status changed', {
        userId,
        isActive
      });

      return result.rows[0];

    } catch (error) {
      Logger.error('Error updating user active status', { userId, isActive, error });
      throw error;
    }
  }

  /**
   * Busca usuário sem campos sensíveis
   */
  async findByIdPublic(id, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT id, name, email, phone, role, is_active, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      );

      return result.rows[0] || null;

    } catch (error) {
      Logger.error('Error finding user by id (public)', { userId: id, error });
      throw error;
    }
  }

  /**
   * Busca usuários com filtros avançados
   */
  async searchUsers(searchOptions = {}) {
    const {
      search = '',
      role = null,
      isActive = null,
      page = 1,
      limit = 20,
      orderBy = 'name',
      orderDirection = 'ASC'
    } = searchOptions;

    try {
      let baseQuery = `
        SELECT id, name, email, phone, role, is_active, created_at, updated_at
        FROM users
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      // Filtro por busca de texto
      if (search) {
        paramCount++;
        baseQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Filtro por role
      if (role) {
        paramCount++;
        baseQuery += ` AND role = $${paramCount}`;
        params.push(role);
      }

      // Filtro por status ativo
      if (isActive !== null) {
        paramCount++;
        baseQuery += ` AND is_active = $${paramCount}`;
        params.push(isActive);
      }

      // Ordenação
      baseQuery += ` ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;

      // Paginação
      const offset = (page - 1) * limit;
      baseQuery += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await this.db.query(baseQuery, params);

      // Busca total para paginação
      let countQuery = baseQuery.split('ORDER BY')[0].replace(
        'SELECT id, name, email, phone, role, is_active, created_at, updated_at',
        'SELECT COUNT(*)'
      );

      const countResult = await this.db.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].count);

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      Logger.error('Error searching users', { searchOptions, error });
      throw error;
    }
  }

  /**
   * Obtém estatísticas de usuários
   */
  async getUserStatistics() {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN role = 'client' THEN 1 END) as total_clients,
          COUNT(CASE WHEN role = 'barber' THEN 1 END) as total_barbers,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as total_admins,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_users,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_users_last_30_days
        FROM users
      `);

      return result.rows[0];

    } catch (error) {
      Logger.error('Error getting user statistics', error);
      throw error;
    }
  }
}

module.exports = { UserRepository };