const { BaseRepository } = require('../../shared/database/BaseRepository');
const { AppError } = require('../../shared/errors/AppError');

// =====================================================
// REPOSITÓRIO DE USUÁRIOS COM SQL LOCKS
// =====================================================

class UserRepository extends BaseRepository {
  constructor() {
    super();
    this.tableName = 'users';
  }

  // =====================================================
  // 🔐 CRIAÇÃO DE USUÁRIO COM VALIDAÇÃO
  // =====================================================

  async createUser(userData) {
    return this.executeTransaction(async (client) => {
      // Verificar se email já existe (com lock)
      const existingUser = await client.query(
        `SELECT id FROM users WHERE email = $1 FOR UPDATE`,
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw AppError.duplicateEntry('email', userData.email);
      }

      // Criar usuário
      const query = `
        INSERT INTO users (name, email, password_hash, role, phone, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, email, role, phone, is_active, created_at
      `;

      const result = await client.query(query, [
        userData.name,
        userData.email,
        userData.password_hash,
        userData.role || 'CLIENT',
        userData.phone || null,
        userData.is_active !== false // default true
      ]);

      console.log(`✅ User created: ${userData.email} (${userData.role || 'CLIENT'})`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 🔍 BUSCAR USUÁRIO POR EMAIL (PARA LOGIN)
  // =====================================================

  async findByEmail(email) {
    const query = `
      SELECT id, name, email, password_hash, role, phone, is_active, created_at, updated_at
      FROM users 
      WHERE email = $1 AND is_active = true
    `;

    return this.queryOne(query, [email]);
  }

  async findByEmailWithPassword(email) {
    // Método específico para login que inclui password_hash
    const query = `
      SELECT id, name, email, password_hash, role, phone, is_active, created_at
      FROM users 
      WHERE email = $1 AND is_active = true
    `;

    return this.queryOne(query, [email]);
  }

  // =====================================================
  // 📊 BUSCAR USUÁRIO POR ID (SEM SENHA)
  // =====================================================

  async findById(id) {
    const query = `
      SELECT id, name, email, role, phone, is_active, created_at, updated_at
      FROM users 
      WHERE id = $1 AND is_active = true
    `;

    return this.queryOne(query, [id]);
  }

  async findByIdWithRole(id, requiredRole = null) {
    const query = `
      SELECT id, name, email, role, phone, is_active, created_at, updated_at
      FROM users 
      WHERE id = $1 AND is_active = true
      ${requiredRole ? 'AND role = $2' : ''}
    `;

    const params = requiredRole ? [id, requiredRole] : [id];
    return this.queryOne(query, params);
  }

  // =====================================================
  // 📋 LISTAR USUÁRIOS (APENAS ADMINS)
  // =====================================================

  async findAllUsers(filters = {}, pagination = {}) {
    let query = `
      SELECT id, name, email, role, phone, is_active, created_at, updated_at
      FROM users 
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filtros opcionais
    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Ordenação
    query += ` ORDER BY created_at DESC`;

    // Paginação
    if (pagination.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(pagination.limit);
      paramIndex++;

      if (pagination.offset) {
        query += ` OFFSET $${paramIndex}`;
        params.push(pagination.offset);
      }
    }

    return this.queryMany(query, params);
  }

  async countUsers(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM users WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (filters.role) {
      query += ` AND role = $${paramIndex}`;
      params.push(filters.role);
      paramIndex++;
    }

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
    }

    const result = await this.queryOne(query, params);
    return parseInt(result.total);
  }

  // =====================================================
  // ✏️ ATUALIZAR USUÁRIO
  // =====================================================

  async updateUser(id, updateData) {
    return this.executeTransaction(async (client) => {
      // Verificar se usuário existe (com lock)
      const existingUser = await client.query(
        `SELECT id FROM users WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingUser.rows.length === 0) {
        throw AppError.userNotFound();
      }

      // Se está alterando email, verificar duplicação
      if (updateData.email) {
        const emailCheck = await client.query(
          `SELECT id FROM users WHERE email = $1 AND id != $2`,
          [updateData.email, id]
        );

        if (emailCheck.rows.length > 0) {
          throw AppError.duplicateEntry('email', updateData.email);
        }
      }

      // Montar query de update dinâmica
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`);

      const query = `
        UPDATE users 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, email, role, phone, is_active, updated_at
      `;

      const result = await client.query(query, [id, ...values]);
      
      console.log(`✅ User updated: ${id}`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 🔐 ATUALIZAR SENHA
  // =====================================================

  async updatePassword(id, newPasswordHash) {
    return this.executeTransaction(async (client) => {
      const query = `
        UPDATE users 
        SET password_hash = $2, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING id, email
      `;

      const result = await client.query(query, [id, newPasswordHash]);

      if (result.rows.length === 0) {
        throw AppError.userNotFound();
      }

      console.log(`🔐 Password updated for user: ${id}`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 🗑️ DESATIVAR USUÁRIO (SOFT DELETE)
  // =====================================================

  async deactivateUser(id) {
    return this.executeTransaction(async (client) => {
      const query = `
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING id, email
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw AppError.userNotFound();
      }

      console.log(`🗑️ User deactivated: ${id}`);
      return result.rows[0];
    });
  }

  async reactivateUser(id) {
    return this.executeTransaction(async (client) => {
      const query = `
        UPDATE users 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, is_active
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw AppError.userNotFound();
      }

      console.log(`✅ User reactivated: ${id}`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 📊 ESTATÍSTICAS DE USUÁRIOS
  // =====================================================

  async getUserStats() {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role = 'CLIENT') as total_clients,
        COUNT(*) FILTER (WHERE role = 'ADMIN') as total_admins,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_users_month
      FROM users
    `;

    return this.queryOne(query);
  }

  async getUsersByRole() {
    const query = `
      SELECT 
        role,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_active = true) as active_count
      FROM users
      GROUP BY role
      ORDER BY role
    `;

    return this.queryMany(query);
  }

  // =====================================================
  // 🔍 BUSCA AVANÇADA
  // =====================================================

  async searchUsers(searchTerm, role = null, limit = 20) {
    let query = `
      SELECT id, name, email, role, phone, is_active, created_at
      FROM users 
      WHERE is_active = true
      AND (name ILIKE $1 OR email ILIKE $1)
    `;

    const params = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE 
        WHEN name ILIKE $1 THEN 1
        WHEN email ILIKE $1 THEN 2
        ELSE 3
      END,
      name ASC
      LIMIT $${paramIndex}
    `;

    params.push(limit);

    return this.queryMany(query, params);
  }

  // =====================================================
  // 🔍 VERIFICAÇÕES DE EXISTÊNCIA
  // =====================================================

  async emailExists(email) {
    const query = `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists`;
    const result = await this.queryOne(query, [email]);
    return result.exists;
  }

  async userExistsAndActive(id) {
    const query = `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND is_active = true) as exists`;
    const result = await this.queryOne(query, [id]);
    return result.exists;
  }

  async isUserAdmin(id) {
    const query = `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND role = 'ADMIN' AND is_active = true) as is_admin`;
    const result = await this.queryOne(query, [id]);
    return result.is_admin;
  }
}

module.exports = { UserRepository };