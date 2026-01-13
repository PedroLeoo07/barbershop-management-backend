import { database } from '../database';
import { 
  Service, 
  CreateServiceData, 
  UpdateServiceData 
} from '../models';

export class ServiceRepository {
  /**
   * Buscar serviço por ID
   */
  static async findById(id: string): Promise<Service | null> {
    const query = `
      SELECT 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
      FROM services 
      WHERE id = $1
    `;
    
    const result = await database.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Buscar serviço por nome
   */
  static async findByName(name: string): Promise<Service | null> {
    const query = `
      SELECT 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
      FROM services 
      WHERE LOWER(name) = LOWER($1) AND is_active = true
    `;
    
    const result = await database.query(query, [name]);
    return result.rows[0] || null;
  }

  /**
   * Criar novo serviço
   */
  static async create(serviceData: CreateServiceData): Promise<Service> {
    const query = `
      INSERT INTO services (name, description, duration_minutes, price)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
    `;
    
    const values = [
      serviceData.name,
      serviceData.description || null,
      serviceData.duration_minutes,
      serviceData.price
    ];
    
    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Atualizar serviço
   */
  static async update(id: string, serviceData: UpdateServiceData): Promise<Service | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (serviceData.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(serviceData.name);
    }

    if (serviceData.description !== undefined) {
      fields.push(`description = $${paramCount++}`);
      values.push(serviceData.description);
    }

    if (serviceData.duration_minutes !== undefined) {
      fields.push(`duration_minutes = $${paramCount++}`);
      values.push(serviceData.duration_minutes);
    }

    if (serviceData.price !== undefined) {
      fields.push(`price = $${paramCount++}`);
      values.push(serviceData.price);
    }

    if (serviceData.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(serviceData.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE services 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
    `;

    const result = await database.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Deletar serviço (soft delete)
   */
  static async softDelete(id: string): Promise<boolean> {
    const query = `
      UPDATE services 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `;
    
    const result = await database.query(query, [id]);
    return result.rowCount ? result.rowCount > 0 : false;
  }

  /**
   * Listar serviços com paginação
   */
  static async findAll(params: {
    page: number;
    limit: number;
    active?: boolean;
    search?: string;
  }): Promise<{ services: Service[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (params.active !== undefined) {
      conditions.push(`is_active = $${paramCount++}`);
      values.push(params.active);
    }

    if (params.search) {
      conditions.push(`name ILIKE $${paramCount++}`);
      values.push(`%${params.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM services
      ${whereClause}
    `;

    // Query para buscar serviços
    const servicesQuery = `
      SELECT 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
      FROM services
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(params.limit, offset);

    const [countResult, servicesResult] = await Promise.all([
      database.query(countQuery, values.slice(0, -2)),
      database.query(servicesQuery, values)
    ]);

    return {
      services: servicesResult.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Buscar serviços ativos
   */
  static async findActive(): Promise<Service[]> {
    const query = `
      SELECT 
        id,
        name,
        description,
        duration_minutes,
        price,
        is_active,
        created_at,
        updated_at
      FROM services 
      WHERE is_active = true
      ORDER BY name ASC
    `;
    
    const result = await database.query(query);
    return result.rows;
  }

  /**
   * Buscar estatísticas dos serviços para dashboard
   */
  static async getServiceStats(): Promise<{
    total_services: number;
    active_services: number;
    avg_price: number;
    avg_duration: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_services,
        COUNT(*) FILTER (WHERE is_active = true) as active_services,
        COALESCE(AVG(price) FILTER (WHERE is_active = true), 0) as avg_price,
        COALESCE(AVG(duration_minutes) FILTER (WHERE is_active = true), 0) as avg_duration
      FROM services
    `;

    const result = await database.query(query);
    const stats = result.rows[0];
    
    return {
      total_services: parseInt(stats.total_services),
      active_services: parseInt(stats.active_services),
      avg_price: parseFloat(stats.avg_price),
      avg_duration: parseFloat(stats.avg_duration)
    };
  }

  /**
   * Buscar popularidade dos serviços (para dashboard)
   */
  static async getServicePopularity(params: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Array<{
    service_id: string;
    service_name: string;
    appointment_count: number;
    total_revenue: number;
  }>> {
    const conditions: string[] = ['a.status = \'COMPLETED\''];
    const values: any[] = [];
    let paramCount = 1;

    if (params.startDate) {
      conditions.push(`a.appointment_date >= $${paramCount++}`);
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push(`a.appointment_date <= $${paramCount++}`);
      values.push(params.endDate);
    }

    const limit = params.limit || 10;

    const query = `
      SELECT 
        s.id as service_id,
        s.name as service_name,
        COUNT(a.id) as appointment_count,
        SUM(a.total_price) as total_revenue
      FROM services s
      LEFT JOIN appointments a ON s.id = a.service_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY s.id, s.name
      HAVING COUNT(a.id) > 0
      ORDER BY appointment_count DESC, total_revenue DESC
      LIMIT $${paramCount}
    `;

    values.push(limit);

    const result = await database.query(query, values);
    return result.rows.map(row => ({
      service_id: row.service_id,
      service_name: row.service_name,
      appointment_count: parseInt(row.appointment_count),
      total_revenue: parseFloat(row.total_revenue || 0)
    }));
  }

  /**
   * Verificar se nome de serviço já existe
   */
  static async nameExists(name: string, excludeId?: string): Promise<boolean> {
    let query = `
      SELECT 1 FROM services 
      WHERE LOWER(name) = LOWER($1) AND is_active = true
    `;
    const values: any[] = [name];

    if (excludeId) {
      query += ` AND id != $2`;
      values.push(excludeId);
    }

    const result = await database.query(query, values);
    return result.rows.length > 0;
  }
}