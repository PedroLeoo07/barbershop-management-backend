const { BaseRepository } = require('../base.repository');

// =====================================================
// REPOSITÓRIO DE USUÁRIOS - NOVA ESTRUTURA
// =====================================================

class UserRepository extends BaseRepository {
  constructor() {
    super();
    this.tableName = 'users';
  }

  // =====================================================
  // ➕ CRIAR USUÁRIO
  // =====================================================

  async createUser(userData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock para verificar email único
      await client.query(`
        SELECT 1 FROM users 
        WHERE email = $1
        FOR UPDATE NOWAIT
      `, [userData.email]);

      // Verificar se email já existe
      const existing = await client.query(`
        SELECT id FROM users 
        WHERE email = $1
      `, [userData.email]);

      if (existing.rows.length > 0) {
        throw { code: 'EMAIL_EXISTS', message: 'Email já está em uso' };
      }

      // Inserir novo usuário
      const result = await client.query(`
        INSERT INTO users (
          name, 
          email, 
          password_hash, 
          role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, role, created_at
      `, [
        userData.name,
        userData.email,
        userData.password_hash,
        userData.role || 'CLIENT'
      ]);

      await client.query('COMMIT');
      
      console.log(`[UserRepository] Usuário criado: ${userData.email} - ${userData.role || 'CLIENT'}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[UserRepository] Erro ao criar usuário:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 🔍 BUSCAR USUÁRIO POR EMAIL
  // =====================================================

  async findByEmail(email) {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, name, email, role, created_at
        FROM users 
        WHERE email = $1
      `, [email]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('[UserRepository] Erro ao buscar usuário por email:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔐 BUSCAR USUÁRIO COM SENHA (PARA LOGIN)
  // =====================================================

  async findByEmailWithPassword(email) {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, name, email, password_hash, role, created_at
        FROM users 
        WHERE email = $1
      `, [email]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('[UserRepository] Erro ao buscar usuário com senha:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR USUÁRIO POR ID
  // =====================================================

  async findById(userId) {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, name, email, role, created_at
        FROM users 
        WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' };
      }

      return result.rows[0];
    } catch (error) {
      console.error('[UserRepository] Erro ao buscar usuário por ID:', error);
      throw error;
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR USUÁRIO
  // =====================================================

  async updateUser(userId, updateData) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock no usuário
      await client.query(`
        SELECT id FROM users 
        WHERE id = $1
        FOR UPDATE NOWAIT
      `, [userId]);

      // Verificar se existe
      const existing = await client.query(`
        SELECT * FROM users 
        WHERE id = $1
      `, [userId]);

      if (existing.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' };
      }

      // Se mudando email, verificar duplicatas
      if (updateData.email && updateData.email !== existing.rows[0].email) {
        const emailCheck = await client.query(`
          SELECT id FROM users 
          WHERE email = $1 AND id != $2
        `, [updateData.email, userId]);

        if (emailCheck.rows.length > 0) {
          throw { code: 'EMAIL_EXISTS', message: 'Email já está em uso' };
        }
      }

      // Construir query de update dinamicamente
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updateData)) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }

      const result = await client.query(`
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, email, role, created_at
      `, [...values, userId]);

      await client.query('COMMIT');
      
      console.log(`[UserRepository] Usuário atualizado: ${userId}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[UserRepository] Erro ao atualizar usuário:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 🗑️ DELETAR USUÁRIO
  // =====================================================

  async deleteUser(userId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verificar se usuário tem agendamentos futuros
      const futureAppointments = await client.query(`
        SELECT COUNT(*) as count
        FROM appointments 
        WHERE user_id = $1 
          AND appointment_date >= CURRENT_DATE
          AND status NOT IN ('CANCELED')
      `, [userId]);

      if (parseInt(futureAppointments.rows[0].count) > 0) {
        throw { 
          code: 'USER_HAS_FUTURE_APPOINTMENTS', 
          message: 'Não é possível remover usuário com agendamentos futuros' 
        };
      }

      // Deletar usuário (hard delete nesta estrutura)
      const result = await client.query(`
        DELETE FROM users 
        WHERE id = $1
        RETURNING id
      `, [userId]);

      if (result.rows.length === 0) {
        throw { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado' };
      }

      await client.query('COMMIT');
      
      console.log(`[UserRepository] Usuário removido: ${userId}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[UserRepository] Erro ao deletar usuário:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 📋 LISTAR USUÁRIOS COM FILTROS
  // =====================================================

  async listUsers(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        search
      } = filters;

      const offset = (page - 1) * limit;
      
      // Construir WHERE clause dinamicamente
      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (role) {
        conditions.push(`role = $${paramCount}`);
        params.push(role);
        paramCount++;
      }

      if (search) {
        conditions.push(`(
          LOWER(name) LIKE LOWER($${paramCount}) OR 
          LOWER(email) LIKE LOWER($${paramCount + 1})
        )`);
        params.push(`%${search}%`, `%${search}%`);
        paramCount += 2;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Query principal
      const result = await this.pool.query(`
        SELECT 
          id, name, email, role, created_at,
          COUNT(*) OVER() as total_count
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        users: result.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('[UserRepository] Erro ao listar usuários:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR USUÁRIOS POR TEXTO
  // =====================================================

  async searchUsers(searchTerm, limit = 20) {
    try {
      const result = await this.pool.query(`
        SELECT 
          id, name, email, role, created_at,
          -- Ranking por relevância
          (
            CASE 
              WHEN LOWER(email) = LOWER($1) THEN 100
              WHEN LOWER(name) = LOWER($1) THEN 90
              WHEN LOWER(email) LIKE LOWER($2) THEN 80
              WHEN LOWER(name) LIKE LOWER($2) THEN 70
              ELSE 60
            END
          ) as relevance_score
        FROM users
        WHERE (
          LOWER(name) LIKE LOWER($2) OR
          LOWER(email) LIKE LOWER($2)
        )
        ORDER BY relevance_score DESC, name ASC
        LIMIT $3
      `, [searchTerm, `%${searchTerm}%`, limit]);

      return result.rows;
    } catch (error) {
      console.error('[UserRepository] Erro ao buscar usuários:', error);
      throw error;
    }
  }
}

module.exports = { UserRepository };

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