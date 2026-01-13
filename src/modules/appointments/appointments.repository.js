// =====================================================
// REPOSITORY DE AGENDAMENTOS COM SQL LOCKS PROFISSIONAL
// =====================================================

const { BaseRepository } = require('../../shared/repository/BaseRepository');
const { AppError } = require('../../shared/errors/AppError');
const { Logger } = require('../../shared/utils/Logger');

class AppointmentsRepository extends BaseRepository {
  constructor(pool) {
    super(pool);
    this.tableName = 'appointments';
  }

  // =====================================================
  // 🔐 CRIAÇÃO COM LOCK SQL (NÍVEL ALTO)
  // =====================================================

  async createWithLock(appointmentData) {
    const client = await this.pool.connect();

    try {
      // Inicia transação
      await client.query('BEGIN');

      const { 
        barber_id, 
        appointment_date, 
        appointment_time,
        user_id,
        service_id,
        duration = 30
      } = appointmentData;

      Logger.database('Starting appointment creation with lock', {
        barber_id,
        appointment_date,
        appointment_time,
        duration
      });

      // 🔒 LOCK SQL - EVITA DOIS CLIENTES NO MESMO HORÁRIO
      const lockQuery = `
        SELECT id
        FROM appointments
        WHERE barber_id = $1
          AND appointment_date = $2
          AND appointment_time = $3
          AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
        FOR UPDATE NOWAIT
      `;

      const conflictResult = await client.query(lockQuery, [
        barber_id,
        appointment_date,
        appointment_time
      ]);

      // Se encontrou conflito, cancela
      if (conflictResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new AppError('Horário já ocupado', 409);
      }

      // Verifica também overlapping (agendamentos que se sobrepõem)
      const overlapQuery = `
        SELECT id, appointment_time, 
               (appointment_time::time + INTERVAL '1 minute' * duration) as end_time
        FROM appointments
        WHERE barber_id = $1
          AND appointment_date = $2
          AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
          AND (
            -- Novo agendamento começa antes do existente terminar
            ($3::time >= appointment_time::time AND $3::time < (appointment_time::time + INTERVAL '1 minute' * duration))
            OR
            -- Novo agendamento termina depois do existente começar
            (($3::time + INTERVAL '1 minute' * $4) > appointment_time::time AND ($3::time + INTERVAL '1 minute' * $4) <= (appointment_time::time + INTERVAL '1 minute' * duration))
            OR
            -- Novo agendamento engloba o existente
            ($3::time <= appointment_time::time AND ($3::time + INTERVAL '1 minute' * $4) >= (appointment_time::time + INTERVAL '1 minute' * duration))
          )
        FOR UPDATE
      `;

      const overlapResult = await client.query(overlapQuery, [
        barber_id,
        appointment_date,
        appointment_time,
        duration
      ]);

      if (overlapResult.rows.length > 0) {
        await client.query('ROLLBACK');
        throw new AppError('Horário conflita com agendamento existente', 409);
      }

      // Se chegou aqui, horário está livre - cria o agendamento
      const insertQuery = `
        INSERT INTO appointments (
          user_id,
          barber_id,
          service_id,
          appointment_date,
          appointment_time,
          duration,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'SCHEDULED', NOW())
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        user_id,
        barber_id,
        service_id,
        appointment_date,
        appointment_time,
        duration
      ]);

      // Commit da transação
      await client.query('COMMIT');

      Logger.appointment('Appointment created successfully with lock', {
        appointmentId: result.rows[0].id,
        barber_id,
        appointment_date,
        appointment_time
      });

      return result.rows[0];

    } catch (error) {
      // Rollback em caso de erro
      await client.query('ROLLBACK');

      Logger.appointment('Failed to create appointment', {
        error: error.message,
        barber_id: appointmentData.barber_id
      });

      if (error instanceof AppError) {
        throw error;
      }

      // Erro específico de lock
      if (error.code === '55P03') {
        throw new AppError('Horário sendo processado por outro usuário', 409);
      }

      throw new AppError('Erro ao criar agendamento', 500);
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 📅 BUSCAR AGENDAMENTOS POR BARBEIRO E DATA
  // =====================================================

  async findByBarberAndDate(barberId, date) {
    try {
      const query = `
        SELECT 
          a.*,
          u.name as client_name,
          u.phone as client_phone,
          s.name as service_name,
          s.duration as service_duration
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        JOIN services s ON a.service_id = s.id
        WHERE a.barber_id = $1
          AND a.appointment_date = $2
          AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
        ORDER BY a.appointment_time ASC
      `;

      const result = await this.pool.query(query, [barberId, date]);

      Logger.database('Retrieved appointments by barber and date', {
        barberId,
        date,
        count: result.rows.length
      });

      return result.rows;
    } catch (error) {
      Logger.database('Error finding appointments by barber and date', {
        barberId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 🕒 BUSCAR AGENDAMENTOS EM CONFLITO
  // =====================================================

  async findConflicts(barberId, date, startTime, duration) {
    try {
      const query = `
        SELECT 
          id,
          appointment_time,
          duration,
          (appointment_time::time + INTERVAL '1 minute' * duration) as end_time
        FROM appointments
        WHERE barber_id = $1
          AND appointment_date = $2
          AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
          AND (
            -- Verifica se há sobreposição de horários
            ($3::time < (appointment_time::time + INTERVAL '1 minute' * duration))
            AND
            (($3::time + INTERVAL '1 minute' * $4) > appointment_time::time)
          )
      `;

      const result = await this.pool.query(query, [
        barberId,
        date,
        startTime,
        duration
      ]);

      return result.rows;
    } catch (error) {
      Logger.database('Error checking conflicts', {
        barberId,
        date,
        startTime,
        duration,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 📊 ESTATÍSTICAS RÁPIDAS
  // =====================================================

  async getBarberStats(barberId, startDate, endDate) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_appointments,
          COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
          SUM(CASE WHEN status = 'COMPLETED' THEN 
            (SELECT price FROM services WHERE id = service_id) 
            ELSE 0 END
          ) as total_revenue
        FROM appointments
        WHERE barber_id = $1
          AND appointment_date BETWEEN $2 AND $3
      `;

      const result = await this.pool.query(query, [barberId, startDate, endDate]);

      return {
        ...result.rows[0],
        total_revenue: parseFloat(result.rows[0].total_revenue || 0)
      };
    } catch (error) {
      Logger.database('Error getting barber stats', {
        barberId,
        startDate,
        endDate,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 🔄 ATUALIZAR STATUS
  // =====================================================

  async updateStatus(id, status, notes = null) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        UPDATE appointments
        SET status = $2, 
            notes = COALESCE($3, notes),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [id, status, notes]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new AppError('Agendamento não encontrado', 404);
      }

      await client.query('COMMIT');

      Logger.appointment('Appointment status updated', {
        appointmentId: id,
        newStatus: status,
        notes
      });

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 📋 BUSCAR POR ID COM DETALHES
  // =====================================================

  async findByIdWithDetails(id) {
    try {
      const query = `
        SELECT 
          a.*,
          u.name as client_name,
          u.email as client_email,
          u.phone as client_phone,
          b.name as barber_name,
          b.email as barber_email,
          s.name as service_name,
          s.description as service_description,
          s.price as service_price,
          s.duration as service_duration
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        JOIN users b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE a.id = $1
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      Logger.database('Error finding appointment by ID with details', {
        appointmentId: id,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = { AppointmentsRepository };