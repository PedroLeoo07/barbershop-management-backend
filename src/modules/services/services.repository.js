const { BaseRepository } = require('../base.repository');

// =====================================================
// REPOSITORY PARA SERVIÇOS DA BARBEARIA
// =====================================================

class ServiceRepository extends BaseRepository {
  constructor() {
    super();
    this.tableName = 'services';
  }

  // =====================================================
  // ➕ CRIAR SERVIÇO
  // =====================================================

  async createService(serviceData, createdBy) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock para evitar duplicatas de nome
      await client.query(`
        SELECT 1 FROM services 
        WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL
        FOR UPDATE NOWAIT
      `, [serviceData.name]);

      // Verificar se já existe serviço com este nome
      const existing = await client.query(`
        SELECT id FROM services 
        WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL
      `, [serviceData.name]);

      if (existing.rows.length > 0) {
        throw { code: 'SERVICE_NAME_EXISTS', message: 'Já existe um serviço com este nome' };
      }

      // Inserir novo serviço
      const result = await client.query(`
        INSERT INTO services (
          name, 
          description, 
          price_min, 
          price_max, 
          duration_min, 
          duration_max, 
          category,
          is_combo,
          is_active,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        serviceData.name,
        serviceData.description || null,
        serviceData.price_min,
        serviceData.price_max || serviceData.price_min,
        serviceData.duration_min,
        serviceData.duration_max || serviceData.duration_min,
        serviceData.category || 'geral',
        serviceData.is_combo || false,
        serviceData.is_active !== false, // Default true
        createdBy
      ]);

      await client.query('COMMIT');
      
      console.log(`[ServiceRepository] Serviço criado: ${result.rows[0].id} - ${serviceData.name}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ServiceRepository] Erro ao criar serviço:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇO POR ID
  // =====================================================

  async findById(serviceId) {
    try {
      const result = await this.pool.query(`
        SELECT 
          s.*,
          u.name as created_by_name,
          uu.name as updated_by_name
        FROM services s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN users uu ON s.updated_by = uu.id
        WHERE s.id = $1 AND s.deleted_at IS NULL
      `, [serviceId]);

      if (result.rows.length === 0) {
        throw { code: 'SERVICE_NOT_FOUND', message: 'Serviço não encontrado' };
      }

      return result.rows[0];
    } catch (error) {
      console.error('[ServiceRepository] Erro ao buscar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR SERVIÇO
  // =====================================================

  async updateService(serviceId, updateData, updatedBy) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Lock no serviço
      await client.query(`
        SELECT id FROM services 
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE NOWAIT
      `, [serviceId]);

      // Verificar se existe
      const existing = await client.query(`
        SELECT * FROM services 
        WHERE id = $1 AND deleted_at IS NULL
      `, [serviceId]);

      if (existing.rows.length === 0) {
        throw { code: 'SERVICE_NOT_FOUND', message: 'Serviço não encontrado' };
      }

      // Se mudando nome, verificar duplicatas
      if (updateData.name && updateData.name !== existing.rows[0].name) {
        const nameCheck = await client.query(`
          SELECT id FROM services 
          WHERE LOWER(name) = LOWER($1) AND id != $2 AND deleted_at IS NULL
        `, [updateData.name, serviceId]);

        if (nameCheck.rows.length > 0) {
          throw { code: 'SERVICE_NAME_EXISTS', message: 'Já existe um serviço com este nome' };
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

      // Adicionar campos de auditoria
      fields.push(`updated_by = $${paramCount}`, `updated_at = NOW()`);
      values.push(updatedBy);

      const result = await client.query(`
        UPDATE services 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount + 1}
        RETURNING *
      `, [...values, serviceId]);

      await client.query('COMMIT');
      
      console.log(`[ServiceRepository] Serviço atualizado: ${serviceId}`);
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ServiceRepository] Erro ao atualizar serviço:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 🗑️ DELETAR SERVIÇO (SOFT DELETE)
  // =====================================================

  async deleteService(serviceId, deletedBy) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verificar se tem agendamentos futuros
      const futureAppointments = await client.query(`
        SELECT COUNT(*) as count
        FROM appointments a
        JOIN appointment_services aps ON a.id = aps.appointment_id
        WHERE aps.service_id = $1 
          AND a.appointment_date > NOW()
          AND a.status NOT IN ('cancelled', 'no_show')
      `, [serviceId]);

      if (parseInt(futureAppointments.rows[0].count) > 0) {
        throw { 
          code: 'SERVICE_HAS_FUTURE_APPOINTMENTS', 
          message: 'Não é possível remover serviço com agendamentos futuros' 
        };
      }

      // Soft delete
      const result = await client.query(`
        UPDATE services 
        SET 
          deleted_at = NOW(),
          updated_by = $1,
          updated_at = NOW(),
          is_active = false
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING *
      `, [deletedBy, serviceId]);

      if (result.rows.length === 0) {
        throw { code: 'SERVICE_NOT_FOUND', message: 'Serviço não encontrado' };
      }

      await client.query('COMMIT');
      
      console.log(`[ServiceRepository] Serviço removido: ${serviceId}`);
      return true;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[ServiceRepository] Erro ao deletar serviço:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 📋 LISTAR SERVIÇOS COM FILTROS
  // =====================================================

  async listServices(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        is_active,
        category,
        search,
        price_min,
        price_max,
        duration_min,
        duration_max,
        is_combo
      } = filters;

      const offset = (page - 1) * limit;
      
      // Construir WHERE clause dinamicamente
      const conditions = ['s.deleted_at IS NULL'];
      const params = [];
      let paramCount = 1;

      if (is_active !== undefined) {
        conditions.push(`s.is_active = $${paramCount}`);
        params.push(is_active);
        paramCount++;
      }

      if (category) {
        conditions.push(`s.category = $${paramCount}`);
        params.push(category);
        paramCount++;
      }

      if (search) {
        conditions.push(`(
          LOWER(s.name) LIKE LOWER($${paramCount}) OR 
          LOWER(s.description) LIKE LOWER($${paramCount + 1})
        )`);
        params.push(`%${search}%`, `%${search}%`);
        paramCount += 2;
      }

      if (price_min !== undefined) {
        conditions.push(`s.price_min >= $${paramCount}`);
        params.push(price_min);
        paramCount++;
      }

      if (price_max !== undefined) {
        conditions.push(`s.price_max <= $${paramCount}`);
        params.push(price_max);
        paramCount++;
      }

      if (duration_min !== undefined) {
        conditions.push(`s.duration_min >= $${paramCount}`);
        params.push(duration_min);
        paramCount++;
      }

      if (duration_max !== undefined) {
        conditions.push(`s.duration_max <= $${paramCount}`);
        params.push(duration_max);
        paramCount++;
      }

      if (is_combo !== undefined) {
        conditions.push(`s.is_combo = $${paramCount}`);
        params.push(is_combo);
        paramCount++;
      }

      const whereClause = conditions.join(' AND ');

      // Query principal
      const result = await this.pool.query(`
        SELECT 
          s.*,
          u.name as created_by_name,
          COUNT(*) OVER() as total_count
        FROM services s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `, [...params, limit, offset]);

      const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
      const totalPages = Math.ceil(totalCount / limit);

      return {
        services: result.rows,
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
      console.error('[ServiceRepository] Erro ao listar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇOS POR TEXTO
  // =====================================================

  async searchServices(searchTerm, limit = 20) {
    try {
      const result = await this.pool.query(`
        SELECT 
          s.id,
          s.name,
          s.description,
          s.price_min,
          s.price_max,
          s.duration_min,
          s.duration_max,
          s.category,
          s.is_combo,
          -- Ranking por relevância
          (
            CASE 
              WHEN LOWER(s.name) = LOWER($1) THEN 100
              WHEN LOWER(s.name) LIKE LOWER($2) THEN 90
              WHEN LOWER(s.description) LIKE LOWER($2) THEN 80
              WHEN LOWER(s.category) = LOWER($1) THEN 70
              ELSE 60
            END
          ) as relevance_score
        FROM services s
        WHERE s.deleted_at IS NULL 
          AND s.is_active = true
          AND (
            LOWER(s.name) LIKE LOWER($2) OR
            LOWER(s.description) LIKE LOWER($2) OR
            LOWER(s.category) LIKE LOWER($2)
          )
        ORDER BY relevance_score DESC, s.name ASC
        LIMIT $3
      `, [searchTerm, `%${searchTerm}%`, limit]);

      return result.rows;
    } catch (error) {
      console.error('[ServiceRepository] Erro ao buscar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 SERVIÇOS POPULARES
  // =====================================================

  async getPopularServices(limit = 10, days = 30) {
    try {
      const result = await this.pool.query(`
        SELECT 
          s.id,
          s.name,
          s.description,
          s.price_min,
          s.price_max,
          s.duration_min,
          s.duration_max,
          s.category,
          s.is_combo,
          COUNT(aps.service_id) as appointment_count,
          SUM(aps.price) as total_revenue
        FROM services s
        LEFT JOIN appointment_services aps ON s.id = aps.service_id
        LEFT JOIN appointments a ON aps.appointment_id = a.id
        WHERE s.deleted_at IS NULL 
          AND s.is_active = true
          AND (a.appointment_date IS NULL OR a.appointment_date >= NOW() - INTERVAL '$1 days')
          AND (a.status IS NULL OR a.status IN ('confirmed', 'completed'))
        GROUP BY s.id, s.name, s.description, s.price_min, s.price_max, s.duration_min, s.duration_max, s.category, s.is_combo
        ORDER BY appointment_count DESC, total_revenue DESC
        LIMIT $2
      `, [days, limit]);

      return result.rows;
    } catch (error) {
      console.error('[ServiceRepository] Erro ao buscar serviços populares:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 RELATÓRIO DE RECEITA POR SERVIÇOS
  // =====================================================

  async getServiceRevenue(filters = {}) {
    try {
      const {
        start_date,
        end_date,
        service_id,
        category
      } = filters;

      const conditions = ['s.deleted_at IS NULL', 'a.status IN ($1, $2)'];
      const params = ['confirmed', 'completed'];
      let paramCount = 3;

      if (start_date) {
        conditions.push(`a.appointment_date >= $${paramCount}`);
        params.push(start_date);
        paramCount++;
      }

      if (end_date) {
        conditions.push(`a.appointment_date <= $${paramCount}`);
        params.push(end_date);
        paramCount++;
      }

      if (service_id) {
        conditions.push(`s.id = $${paramCount}`);
        params.push(service_id);
        paramCount++;
      }

      if (category) {
        conditions.push(`s.category = $${paramCount}`);
        params.push(category);
        paramCount++;
      }

      const result = await this.pool.query(`
        SELECT 
          s.id,
          s.name,
          s.category,
          COUNT(aps.service_id) as appointment_count,
          SUM(aps.price) as total_revenue,
          AVG(aps.price) as avg_price,
          MIN(aps.price) as min_price,
          MAX(aps.price) as max_price
        FROM services s
        JOIN appointment_services aps ON s.id = aps.service_id
        JOIN appointments a ON aps.appointment_id = a.id
        WHERE ${conditions.join(' AND ')}
        GROUP BY s.id, s.name, s.category
        ORDER BY total_revenue DESC
      `, params);

      return result.rows;
    } catch (error) {
      console.error('[ServiceRepository] Erro ao gerar relatório de receita:', error);
      throw error;
    }
  }

  // =====================================================
  // 📂 CATEGORIAS DE SERVIÇOS
  // =====================================================

  async getCategories() {
    try {
      const result = await this.pool.query(`
        SELECT 
          category,
          COUNT(*) as service_count,
          AVG(price_min) as avg_price_min,
          AVG(price_max) as avg_price_max,
          MIN(duration_min) as min_duration,
          MAX(duration_max) as max_duration
        FROM services
        WHERE deleted_at IS NULL AND is_active = true
        GROUP BY category
        ORDER BY category ASC
      `);

      return result.rows;
    } catch (error) {
      console.error('[ServiceRepository] Erro ao buscar categorias:', error);
      throw error;
    }
  }
}

module.exports = { ServiceRepository };