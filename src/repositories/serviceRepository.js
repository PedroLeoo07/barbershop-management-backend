// =====================================================
// REPOSITORY DE SERVIÇOS
// =====================================================

const { BaseRepository } = require('./BaseRepository');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

class ServiceRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'services';
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS DE SERVIÇOS
  // =====================================================

  /**
   * Busca serviços ativos
   */
  async findActiveServices(client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT * FROM services 
         WHERE is_active = true 
         ORDER BY name`,
        []
      );

      return result.rows;

    } catch (error) {
      Logger.error('Error finding active services', error);
      throw error;
    }
  }

  /**
   * Busca serviços por faixa de preço
   */
  async findByPriceRange(minPrice, maxPrice, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT * FROM services 
         WHERE price BETWEEN $1 AND $2 
         AND is_active = true 
         ORDER BY price`,
        [minPrice, maxPrice]
      );

      return result.rows;

    } catch (error) {
      Logger.error('Error finding services by price range', { minPrice, maxPrice, error });
      throw error;
    }
  }

  /**
   * Busca serviços por duração
   */
  async findByDuration(duration, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT * FROM services 
         WHERE duration = $1 
         AND is_active = true 
         ORDER BY name`,
        [duration]
      );

      return result.rows;

    } catch (error) {
      Logger.error('Error finding services by duration', { duration, error });
      throw error;
    }
  }

  /**
   * Busca serviços com filtros avançados
   */
  async searchServices(searchOptions = {}) {
    const {
      search = '',
      minPrice = null,
      maxPrice = null,
      minDuration = null,
      maxDuration = null,
      isActive = true,
      page = 1,
      limit = 20,
      orderBy = 'name',
      orderDirection = 'ASC'
    } = searchOptions;

    try {
      let baseQuery = 'SELECT * FROM services WHERE 1=1';
      const params = [];
      let paramCount = 0;

      // Filtro por busca de texto
      if (search) {
        paramCount++;
        baseQuery += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Filtro por preço mínimo
      if (minPrice !== null) {
        paramCount++;
        baseQuery += ` AND price >= $${paramCount}`;
        params.push(minPrice);
      }

      // Filtro por preço máximo
      if (maxPrice !== null) {
        paramCount++;
        baseQuery += ` AND price <= $${paramCount}`;
        params.push(maxPrice);
      }

      // Filtro por duração mínima
      if (minDuration !== null) {
        paramCount++;
        baseQuery += ` AND duration >= $${paramCount}`;
        params.push(minDuration);
      }

      // Filtro por duração máxima
      if (maxDuration !== null) {
        paramCount++;
        baseQuery += ` AND duration <= $${paramCount}`;
        params.push(maxDuration);
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
      let countQuery = baseQuery.split('ORDER BY')[0].replace('SELECT *', 'SELECT COUNT(*)');
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
      Logger.error('Error searching services', { searchOptions, error });
      throw error;
    }
  }

  /**
   * Cria serviço com validações
   */
  async createService(serviceData, client = null) {
    const {
      name,
      description,
      price,
      duration,
      is_active = true
    } = serviceData;

    return await this.withTransaction(async (transactionClient) => {
      // Verifica se já existe serviço com o mesmo nome
      const existingService = await this.findByName(name, transactionClient);
      if (existingService) {
        throw AppError.conflict('Já existe um serviço com este nome');
      }

      // Valida dados
      if (price <= 0) {
        throw AppError.badRequest('Preço deve ser maior que zero');
      }

      if (duration <= 0) {
        throw AppError.badRequest('Duração deve ser maior que zero');
      }

      // Cria o serviço
      const service = await this.create({
        name,
        description,
        price,
        duration,
        is_active
      }, transactionClient);

      Logger.database('Service created', {
        serviceId: service.id,
        name: service.name,
        price: service.price
      });

      return service;
    });
  }

  /**
   * Busca serviço por nome
   */
  async findByName(name, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        'SELECT * FROM services WHERE LOWER(name) = LOWER($1)',
        [name]
      );

      return result.rows[0] || null;

    } catch (error) {
      Logger.error('Error finding service by name', { name, error });
      throw error;
    }
  }

  /**
   * Atualiza preço do serviço
   */
  async updatePrice(serviceId, newPrice, client = null) {
    try {
      if (newPrice <= 0) {
        throw AppError.badRequest('Preço deve ser maior que zero');
      }

      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `UPDATE services 
         SET price = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newPrice, serviceId]
      );

      if (result.rows.length === 0) {
        throw AppError.notFound('Serviço não encontrado');
      }

      Logger.database('Service price updated', {
        serviceId,
        newPrice
      });

      return result.rows[0];

    } catch (error) {
      Logger.error('Error updating service price', { serviceId, newPrice, error });
      throw error;
    }
  }

  /**
   * Obtém estatísticas de serviços
   */
  async getServiceStatistics() {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_services,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_services,
          COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_services,
          ROUND(AVG(price), 2) as average_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          ROUND(AVG(duration), 0) as average_duration,
          MIN(duration) as min_duration,
          MAX(duration) as max_duration
        FROM services
      `);

      return result.rows[0];

    } catch (error) {
      Logger.error('Error getting service statistics', error);
      throw error;
    }
  }

  /**
   * Obtém serviços mais populares (com mais agendamentos)
   */
  async getMostPopularServices(limit = 10) {
    try {
      const result = await this.db.query(`
        SELECT 
          s.*,
          COUNT(a.id) as total_appointments,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
          ROUND(AVG(CASE WHEN a.status = 'completed' THEN s.price END), 2) as average_revenue_per_service
        FROM services s
        LEFT JOIN appointments a ON s.id = a.service_id
        WHERE s.is_active = true
        GROUP BY s.id, s.name, s.description, s.price, s.duration, s.is_active, s.created_at, s.updated_at
        ORDER BY total_appointments DESC, completed_appointments DESC
        LIMIT $1
      `, [limit]);

      return result.rows;

    } catch (error) {
      Logger.error('Error getting most popular services', { limit, error });
      throw error;
    }
  }

  /**
   * Obtém revenue por serviço
   */
  async getServiceRevenue(options = {}) {
    const {
      startDate = null,
      endDate = null,
      serviceId = null
    } = options;

    try {
      let query = `
        SELECT 
          s.id,
          s.name,
          s.price,
          COUNT(a.id) as total_bookings,
          COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_bookings,
          SUM(CASE WHEN a.status = 'completed' THEN a.price ELSE 0 END) as total_revenue,
          ROUND(AVG(CASE WHEN a.status = 'completed' THEN a.price END), 2) as average_revenue_per_booking
        FROM services s
        LEFT JOIN appointments a ON s.id = a.service_id
        WHERE s.is_active = true
      `;

      const params = [];

      if (serviceId) {
        query += ` AND s.id = $${params.length + 1}`;
        params.push(serviceId);
      }

      if (startDate) {
        query += ` AND DATE(a.scheduled_at) >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(a.scheduled_at) <= $${params.length + 1}`;
        params.push(endDate);
      }

      query += `
        GROUP BY s.id, s.name, s.price
        ORDER BY total_revenue DESC NULLS LAST
      `;

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error getting service revenue', { options, error });
      throw error;
    }
  }
}

module.exports = { ServiceRepository };