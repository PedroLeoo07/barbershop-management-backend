const { BaseRepository } = require('../../shared/database/BaseRepository');
const { AppError } = require('../../shared/errors/AppError');

// =====================================================
// REPOSITÓRIO DE BARBEIROS
// =====================================================

class BarberRepository extends BaseRepository {
  constructor() {
    super();
    this.tableName = 'barbers';
  }

  // =====================================================
  // 🔧 CRIAR BARBEIRO
  // =====================================================

  async createBarber(barberData) {
    return this.executeTransaction(async (client) => {
      // Se tem user_id, verificar se é válido e não está sendo usado
      if (barberData.user_id) {
        const userExists = await client.query(
          `SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'`,
          [barberData.user_id]
        );

        if (userExists.rows.length === 0) {
          throw AppError.badRequest('Usuário não encontrado ou não é admin');
        }

        // Verificar se já existe barbeiro para este usuário
        const existingBarber = await client.query(
          `SELECT id FROM barbers WHERE user_id = $1`,
          [barberData.user_id]
        );

        if (existingBarber.rows.length > 0) {
          throw AppError.conflict('Já existe um barbeiro vinculado a este usuário');
        }
      }

      // Criar barbeiro
      const query = `
        INSERT INTO barbers (name, description, user_id, is_active, avatar_url, experience_years, specialties)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const result = await client.query(query, [
        barberData.name,
        barberData.description || null,
        barberData.user_id || null,
        barberData.is_active !== false, // default true
        barberData.avatar_url || null,
        barberData.experience_years || 0,
        barberData.specialties || []
      ]);

      console.log(`✅ Barber created: ${barberData.name}`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 📋 LISTAR BARBEIROS
  // =====================================================

  async findAllBarbers(filters = {}, pagination = {}) {
    let query = `
      SELECT 
        b.*,
        u.name as user_name,
        u.email as user_email
      FROM barbers b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filtros opcionais
    if (filters.is_active !== undefined) {
      query += ` AND b.is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (b.name ILIKE $${paramIndex} OR b.description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.experience_min) {
      query += ` AND b.experience_years >= $${paramIndex}`;
      params.push(filters.experience_min);
      paramIndex++;
    }

    if (filters.specialty) {
      query += ` AND $${paramIndex} = ANY(b.specialties)`;
      params.push(filters.specialty);
      paramIndex++;
    }

    // Ordenação
    query += ` ORDER BY b.name ASC`;

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

  async countBarbers(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM barbers WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (filters.is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(filters.is_active);
      paramIndex++;
    }

    if (filters.search) {
      query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.experience_min) {
      query += ` AND experience_years >= $${paramIndex}`;
      params.push(filters.experience_min);
      paramIndex++;
    }

    if (filters.specialty) {
      query += ` AND $${paramIndex} = ANY(specialties)`;
      params.push(filters.specialty);
    }

    const result = await this.queryOne(query, params);
    return parseInt(result.total);
  }

  // =====================================================
  // 🔍 BUSCAR BARBEIRO POR ID
  // =====================================================

  async findById(id) {
    const query = `
      SELECT 
        b.*,
        u.name as user_name,
        u.email as user_email
      FROM barbers b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = $1
    `;

    return this.queryOne(query, [id]);
  }

  async findActiveById(id) {
    const query = `
      SELECT 
        b.*,
        u.name as user_name,
        u.email as user_email
      FROM barbers b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.id = $1 AND b.is_active = true
    `;

    return this.queryOne(query, [id]);
  }

  // =====================================================
  // 📊 BUSCAR BARBEIROS DISPONÍVEIS
  // =====================================================

  async findAvailableBarbers(date = null, time = null, duration = null) {
    let query = `
      SELECT 
        b.*,
        COUNT(a.id) as appointments_count
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a.barber_id 
        AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
        ${date ? `AND a.appointment_date = $1` : ''}
      WHERE b.is_active = true
    `;

    const params = [];
    let paramIndex = 1;

    if (date) {
      params.push(date);
      paramIndex++;
    }

    // Se especificou horário, verificar conflitos
    if (date && time && duration) {
      query += `
        AND NOT EXISTS (
          SELECT 1 FROM appointments a2 
          WHERE a2.barber_id = b.id 
          AND a2.appointment_date = $1
          AND a2.status NOT IN ('CANCELLED', 'NO_SHOW')
          AND (
            -- Verificar sobreposição de horários
            ($${paramIndex} >= a2.appointment_time 
             AND $${paramIndex} < a2.appointment_time + (a2.duration_minutes || ' minutes')::INTERVAL)
            OR
            (($${paramIndex} + ($${paramIndex + 1} || ' minutes')::INTERVAL)::TIME > a2.appointment_time
             AND ($${paramIndex} + ($${paramIndex + 1} || ' minutes')::INTERVAL)::TIME <= a2.appointment_time + (a2.duration_minutes || ' minutes')::INTERVAL)
            OR
            ($${paramIndex} <= a2.appointment_time
             AND ($${paramIndex} + ($${paramIndex + 1} || ' minutes')::INTERVAL)::TIME >= a2.appointment_time + (a2.duration_minutes || ' minutes')::INTERVAL)
          )
        )
      `;
      params.push(time, duration);
    }

    query += ` GROUP BY b.id ORDER BY appointments_count ASC, b.name ASC`;

    return this.queryMany(query, params);
  }

  // =====================================================
  // ✏️ ATUALIZAR BARBEIRO
  // =====================================================

  async updateBarber(id, updateData) {
    return this.executeTransaction(async (client) => {
      // Verificar se barbeiro existe (com lock)
      const existingBarber = await client.query(
        `SELECT id FROM barbers WHERE id = $1 FOR UPDATE`,
        [id]
      );

      if (existingBarber.rows.length === 0) {
        throw AppError.barberNotFound();
      }

      // Se está alterando user_id, verificar
      if (updateData.user_id) {
        const userExists = await client.query(
          `SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'`,
          [updateData.user_id]
        );

        if (userExists.rows.length === 0) {
          throw AppError.badRequest('Usuário não encontrado ou não é admin');
        }

        // Verificar se já existe barbeiro para este usuário (exceto o atual)
        const existingBarber = await client.query(
          `SELECT id FROM barbers WHERE user_id = $1 AND id != $2`,
          [updateData.user_id, id]
        );

        if (existingBarber.rows.length > 0) {
          throw AppError.conflict('Já existe um barbeiro vinculado a este usuário');
        }
      }

      // Montar query de update dinâmica
      const fields = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`);

      const query = `
        UPDATE barbers 
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id, ...values]);

      console.log(`✅ Barber updated: ${id}`);
      return result.rows[0];
    });
  }

  // =====================================================
  // 🗑️ DESATIVAR/REATIVAR BARBEIRO
  // =====================================================

  async deactivateBarber(id) {
    return this.executeTransaction(async (client) => {
      // Verificar se há agendamentos futuros
      const futureAppointments = await client.query(`
        SELECT COUNT(*) as count
        FROM appointments 
        WHERE barber_id = $1 
        AND appointment_date > CURRENT_DATE
        AND status NOT IN ('CANCELLED', 'NO_SHOW')
      `, [id]);

      if (parseInt(futureAppointments.rows[0].count) > 0) {
        throw AppError.conflict('Barbeiro possui agendamentos futuros. Cancele ou reagende antes de desativar.');
      }

      const query = `
        UPDATE barbers 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        throw AppError.barberNotFound();
      }

      console.log(`🗑️ Barber deactivated: ${id}`);
      return result.rows[0];
    });
  }

  async reactivateBarber(id) {
    const query = `
      UPDATE barbers 
      SET is_active = true, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.queryOne(query, [id]);

    if (!result) {
      throw AppError.barberNotFound();
    }

    console.log(`✅ Barber reactivated: ${id}`);
    return result;
  }

  // =====================================================
  // 📊 ESTATÍSTICAS DE BARBEIROS
  // =====================================================

  async getBarberStats() {
    const query = `
      SELECT 
        COUNT(*) as total_barbers,
        COUNT(*) FILTER (WHERE is_active = true) as active_barbers,
        COUNT(*) FILTER (WHERE is_active = false) as inactive_barbers,
        AVG(experience_years) as avg_experience,
        MAX(experience_years) as max_experience
      FROM barbers
    `;

    return this.queryOne(query);
  }

  async getBarberPerformance(barberId = null, startDate = null, endDate = null) {
    let query = `
      SELECT 
        b.id,
        b.name,
        COUNT(a.id) as total_appointments,
        COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') as completed_appointments,
        COUNT(a.id) FILTER (WHERE a.status = 'NO_SHOW') as no_shows,
        COUNT(a.id) FILTER (WHERE a.status = 'CANCELLED') as cancelled,
        SUM(a.total_price) FILTER (WHERE a.status = 'COMPLETED') as total_revenue,
        AVG(a.total_price) FILTER (WHERE a.status = 'COMPLETED') as avg_ticket
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a.barber_id
    `;

    const params = [];
    const conditions = ['b.is_active = true'];
    let paramIndex = 1;

    if (barberId) {
      conditions.push(`b.id = $${paramIndex}`);
      params.push(barberId);
      paramIndex++;
    }

    if (startDate) {
      conditions.push(`a.appointment_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`a.appointment_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` GROUP BY b.id, b.name ORDER BY total_revenue DESC NULLS LAST`;

    if (barberId) {
      return this.queryOne(query, params);
    }

    return this.queryMany(query, params);
  }

  // =====================================================
  // 🔍 VERIFICAÇÕES E BUSCA
  // =====================================================

  async barberExists(id) {
    const query = `SELECT EXISTS(SELECT 1 FROM barbers WHERE id = $1) as exists`;
    const result = await this.queryOne(query, [id]);
    return result.exists;
  }

  async isBarberActive(id) {
    const query = `SELECT EXISTS(SELECT 1 FROM barbers WHERE id = $1 AND is_active = true) as is_active`;
    const result = await this.queryOne(query, [id]);
    return result.is_active;
  }

  async searchBarbers(searchTerm, limit = 20) {
    const query = `
      SELECT 
        id, name, description, experience_years, specialties, avatar_url
      FROM barbers 
      WHERE is_active = true
      AND (name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(specialties))
      ORDER BY 
        CASE 
          WHEN name ILIKE $1 THEN 1
          WHEN $2 = ANY(specialties) THEN 2
          ELSE 3
        END,
        name ASC
      LIMIT $3
    `;

    return this.queryMany(query, [`%${searchTerm}%`, searchTerm, limit]);
  }

  async getSpecialtiesList() {
    const query = `
      SELECT DISTINCT unnest(specialties) as specialty
      FROM barbers 
      WHERE is_active = true 
      AND specialties IS NOT NULL 
      AND array_length(specialties, 1) > 0
      ORDER BY specialty
    `;

    const result = await this.queryMany(query);
    return result.map(row => row.specialty);
  }
}

module.exports = { BarberRepository };