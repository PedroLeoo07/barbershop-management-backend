// =====================================================
// REPOSITORY DE AGENDAMENTOS
// =====================================================

const { BaseRepository } = require('./BaseRepository');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

class AppointmentRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'appointments';
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS DE AGENDAMENTOS
  // =====================================================

  /**
   * Busca agendamento completo com informações relacionadas
   */
  async findByIdWithDetails(id, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT 
          a.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          b.name as barber_name,
          s.name as service_name,
          s.description as service_description,
          s.duration as service_duration
         FROM appointments a
         JOIN users c ON a.client_id = c.id
         JOIN users b ON a.barber_id = b.id  
         JOIN services s ON a.service_id = s.id
         WHERE a.id = $1`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      Logger.error('Error finding appointment with details', { appointmentId: id, error });
      throw error;
    }
  }

  /**
   * Busca agendamentos de um cliente com paginação
   */
  async findByClient(clientId, options = {}) {
    const {
      limit = 10,
      offset = 0,
      includeCompleted = true,
      includeCancelled = false
    } = options;

    try {
      let query = `
        SELECT 
          a.*,
          b.name as barber_name,
          s.name as service_name,
          s.description as service_description,
          s.duration as service_duration
        FROM appointments a
        JOIN users b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE a.client_id = $1
      `;

      const params = [clientId];
      let paramCount = 1;

      // Filtros de status
      const statusFilters = ['scheduled'];
      if (includeCompleted) statusFilters.push('completed');
      if (includeCancelled) statusFilters.push('cancelled');

      if (statusFilters.length < 3) {
        paramCount++;
        query += ` AND a.status = ANY($${paramCount})`;
        params.push(statusFilters);
      }

      query += ` ORDER BY a.scheduled_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding appointments by client', { clientId, error });
      throw error;
    }
  }

  /**
   * Busca agendamentos de um barbeiro por data
   */
  async findByBarber(barberId, options = {}) {
    const {
      date = null,
      limit = 10,
      offset = 0,
      includeCompleted = true,
      includeCancelled = false
    } = options;

    try {
      let query = `
        SELECT 
          a.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          s.name as service_name,
          s.description as service_description,
          s.duration as service_duration
        FROM appointments a
        JOIN users c ON a.client_id = c.id
        JOIN services s ON a.service_id = s.id
        WHERE a.barber_id = $1
      `;

      const params = [barberId];
      let paramCount = 1;

      // Filtro por data
      if (date) {
        paramCount++;
        query += ` AND DATE(a.scheduled_at) = $${paramCount}`;
        params.push(date);
      }

      // Filtros de status
      const statusFilters = ['scheduled'];
      if (includeCompleted) statusFilters.push('completed');
      if (includeCancelled) statusFilters.push('cancelled');

      if (statusFilters.length < 3) {
        paramCount++;
        query += ` AND a.status = ANY($${paramCount})`;
        params.push(statusFilters);
      }

      query += ` ORDER BY a.scheduled_at ASC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding appointments by barber', { barberId, error });
      throw error;
    }
  }

  /**
   * Busca agendamentos por data específica
   */
  async findByDate(date, barberId = null, client = null) {
    try {
      let query = `
        SELECT 
          a.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          b.name as barber_name,
          s.name as service_name,
          s.description as service_description,
          s.duration as service_duration
        FROM appointments a
        JOIN users c ON a.client_id = c.id
        JOIN users b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE DATE(a.scheduled_at) = $1
      `;

      const params = [date];

      if (barberId) {
        query += ` AND a.barber_id = $2`;
        params.push(barberId);
      }

      query += ` ORDER BY a.scheduled_at ASC`;

      const queryClient = client || this.db;
      const result = await queryClient.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding appointments by date', { date, barberId, error });
      throw error;
    }
  }

  /**
   * Atualiza status do agendamento
   */
  async updateStatus(id, status, client = null) {
    try {
      const queryClient = client || this.db;
      
      const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
      if (!validStatuses.includes(status)) {
        throw AppError.badRequest(`Status inválido: ${status}`);
      }

      const result = await queryClient.query(
        `UPDATE appointments 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (result.rows.length === 0) {
        throw AppError.notFound('Agendamento não encontrado');
      }

      Logger.appointment('Appointment status updated', {
        appointmentId: id,
        newStatus: status
      });

      return result.rows[0];

    } catch (error) {
      Logger.error('Error updating appointment status', { appointmentId: id, status, error });
      throw error;
    }
  }

  /**
   * Busca próximos agendamentos
   */
  async findUpcoming(barberId = null, limit = 20) {
    try {
      let query = `
        SELECT 
          a.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          b.name as barber_name,
          s.name as service_name,
          s.description as service_description,
          s.duration as service_duration
        FROM appointments a
        JOIN users c ON a.client_id = c.id
        JOIN users b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE a.scheduled_at > NOW() 
        AND a.status IN ('scheduled', 'confirmed')
      `;

      const params = [];

      if (barberId) {
        query += ` AND a.barber_id = $1`;
        params.push(barberId);
      }

      query += ` ORDER BY a.scheduled_at ASC LIMIT $${params.length + 1}`;
      params.push(limit);

      const result = await this.db.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding upcoming appointments', { barberId, error });
      throw error;
    }
  }

  /**
   * Busca agendamentos conflitantes
   */
  async findConflicting(barberId, scheduledAt, duration, excludeId = null, client = null) {
    try {
      const queryClient = client || this.db;
      
      // Calcula janela de tempo com buffer
      const startTime = new Date(scheduledAt);
      const endTime = new Date(startTime.getTime() + (duration + 15) * 60000); // +15min buffer

      let query = `
        SELECT id, scheduled_at, duration, status
        FROM appointments
        WHERE barber_id = $1
        AND status NOT IN ('cancelled', 'completed')
        AND (
          (scheduled_at < $3 AND scheduled_at + INTERVAL '1 minute' * (duration + 15) > $2)
          OR
          (scheduled_at >= $2 AND scheduled_at < $3)
        )
      `;

      const params = [barberId, startTime.toISOString(), endTime.toISOString()];

      if (excludeId) {
        query += ` AND id != $${params.length + 1}`;
        params.push(excludeId);
      }

      const result = await queryClient.query(query, params);
      return result.rows;

    } catch (error) {
      Logger.error('Error finding conflicting appointments', { barberId, scheduledAt, error });
      throw error;
    }
  }

  /**
   * Obtém estatísticas de agendamentos
   */
  async getStatistics(options = {}) {
    const {
      barberId = null,
      startDate = null,
      endDate = null
    } = options;

    try {
      let query = `
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_appointments,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_appointments,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_appointments,
          COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_appointments,
          COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_appointments,
          ROUND(AVG(price), 2) as average_price,
          SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END) as total_revenue
        FROM appointments a
        WHERE 1=1
      `;

      const params = [];

      if (barberId) {
        query += ` AND a.barber_id = $${params.length + 1}`;
        params.push(barberId);
      }

      if (startDate) {
        query += ` AND DATE(a.scheduled_at) >= $${params.length + 1}`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(a.scheduled_at) <= $${params.length + 1}`;
        params.push(endDate);
      }

      const result = await this.db.query(query, params);
      return result.rows[0];

    } catch (error) {
      Logger.error('Error getting appointment statistics', { options, error });
      throw error;
    }
  }

  /**
   * Cria agendamento com validações
   */
  async createWithValidation(appointmentData, client = null) {
    const {
      client_id,
      barber_id,
      service_id,
      scheduled_at,
      duration,
      price,
      notes = null
    } = appointmentData;

    return await this.withTransaction(async (transactionClient) => {
      // Verifica conflitos
      const conflicts = await this.findConflicting(
        barber_id,
        scheduled_at,
        duration,
        null,
        transactionClient
      );

      if (conflicts.length > 0) {
        throw AppError.conflict('Horário não disponível - conflito com agendamento existente');
      }

      // Cria o agendamento
      const appointment = await this.create({
        client_id,
        barber_id,
        service_id,
        scheduled_at,
        duration,
        price,
        notes,
        status: 'scheduled'
      }, transactionClient);

      Logger.appointment('Appointment created with validation', {
        appointmentId: appointment.id,
        barberId: barber_id,
        scheduledAt: scheduled_at
      });

      return appointment;
    });
  }
}

module.exports = { AppointmentRepository };