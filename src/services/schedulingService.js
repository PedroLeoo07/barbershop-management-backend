// =====================================================
// SISTEMA AVANÇADO DE AGENDAMENTO
// =====================================================

const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');
const { 
  isValidDateTime, 
  formatDateTime, 
  addMinutes, 
  parseTime,
  formatTime,
  getDateOnly,
  isWeekend,
  getDayOfWeek 
} = require('../utils/datetime');

// =====================================================
// CONFIGURAÇÕES DE HORÁRIO DE FUNCIONAMENTO
// =====================================================

const BUSINESS_HOURS = {
  monday: { open: '08:00', close: '18:00' },
  tuesday: { open: '08:00', close: '18:00' },
  wednesday: { open: '08:00', close: '18:00' },
  thursday: { open: '08:00', close: '18:00' },
  friday: { open: '08:00', close: '18:00' },
  saturday: { open: '08:00', close: '17:00' },
  sunday: null // Fechado
};

const LUNCH_BREAK = {
  start: '12:00',
  end: '13:00'
};

const APPOINTMENT_SLOT_DURATION = 30; // minutos
const BUFFER_TIME = 15; // tempo entre agendamentos em minutos

// =====================================================
// CLASSE PRINCIPAL DO SISTEMA DE AGENDAMENTO
// =====================================================

class AdvancedSchedulingService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Gera slots disponíveis para um barbeiro em uma data específica
   */
  async generateAvailableSlots(barberId, date, serviceId = null) {
    try {
      Logger.appointment('Generating available slots', {
        barberId,
        date: formatDateTime(date),
        serviceId
      });

      // Verifica se a data é válida
      if (!isValidDateTime(date)) {
        throw AppError.badRequest('Data inválida');
      }

      // Verifica se não é uma data passada
      const today = new Date();
      const targetDate = new Date(date);
      
      if (targetDate < getDateOnly(today)) {
        throw AppError.badRequest('Não é possível agendar para datas passadas');
      }

      // Verifica se o barbeiro existe e está ativo
      const barber = await this.getBarberById(barberId);
      if (!barber || !barber.is_active) {
        throw AppError.notFound('Barbeiro não encontrado ou inativo');
      }

      // Verifica horário de funcionamento
      const dayOfWeek = getDayOfWeek(targetDate);
      const businessHour = BUSINESS_HOURS[dayOfWeek.toLowerCase()];
      
      if (!businessHour) {
        return { availableSlots: [], message: 'Barbearia fechada neste dia' };
      }

      // Busca agendamentos existentes
      const existingAppointments = await this.getExistingAppointments(barberId, date);

      // Busca duração do serviço se especificado
      let serviceDuration = APPOINTMENT_SLOT_DURATION;
      if (serviceId) {
        const service = await this.getServiceById(serviceId);
        if (service && service.duration) {
          serviceDuration = service.duration;
        }
      }

      // Gera slots disponíveis
      const availableSlots = this.calculateAvailableSlots(
        businessHour,
        existingAppointments,
        serviceDuration,
        targetDate
      );

      return {
        availableSlots,
        barberName: barber.name,
        date: formatDateTime(targetDate, true),
        serviceDuration
      };

    } catch (error) {
      Logger.error('Error generating available slots', error);
      throw error;
    }
  }

  /**
   * Calcula slots disponíveis baseado nos horários de funcionamento e agendamentos
   */
  calculateAvailableSlots(businessHour, existingAppointments, serviceDuration, date) {
    const slots = [];
    const { open, close } = businessHour;

    // Converte horários para minutos desde meia-noite
    let currentTime = this.timeToMinutes(open);
    const endTime = this.timeToMinutes(close);
    const lunchStart = this.timeToMinutes(LUNCH_BREAK.start);
    const lunchEnd = this.timeToMinutes(LUNCH_BREAK.end);

    while (currentTime + serviceDuration <= endTime) {
      // Pula horário de almoço
      if (currentTime < lunchEnd && currentTime + serviceDuration > lunchStart) {
        currentTime = lunchEnd;
        continue;
      }

      const slotStart = this.minutesToTime(currentTime);
      const slotEnd = this.minutesToTime(currentTime + serviceDuration);

      // Verifica se o slot não conflita com agendamentos existentes
      if (!this.hasConflict(currentTime, serviceDuration, existingAppointments)) {
        // Se é hoje, verifica se ainda não passou
        const now = new Date();
        const slotDateTime = new Date(date);
        const [hours, minutes] = slotStart.split(':').map(Number);
        slotDateTime.setHours(hours, minutes, 0, 0);

        if (date.toDateString() !== now.toDateString() || slotDateTime > now) {
          slots.push({
            start: slotStart,
            end: slotEnd,
            duration: serviceDuration,
            available: true
          });
        }
      }

      currentTime += APPOINTMENT_SLOT_DURATION;
    }

    return slots;
  }

  /**
   * Verifica se há conflito com agendamentos existentes
   */
  hasConflict(slotStart, duration, existingAppointments) {
    const slotEnd = slotStart + duration + BUFFER_TIME;

    return existingAppointments.some(appointment => {
      const appointmentStart = this.timeToMinutes(appointment.time);
      const appointmentEnd = appointmentStart + appointment.duration + BUFFER_TIME;

      // Verifica sobreposição
      return (slotStart < appointmentEnd && slotEnd > appointmentStart);
    });
  }

  /**
   * Reserva um horário específico (com transação)
   */
  async bookAppointment(appointmentData) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const { clientId, barberId, serviceId, date, time } = appointmentData;

      Logger.appointment('Booking appointment', {
        clientId,
        barberId,
        serviceId,
        date: formatDateTime(date),
        time
      });

      // Validações de negócio
      await this.validateBookingRequest(appointmentData, client);

      // Verifica disponibilidade do slot
      const isAvailable = await this.checkSlotAvailability(
        barberId, 
        date, 
        time, 
        serviceId, 
        client
      );

      if (!isAvailable) {
        throw AppError.conflict('Horário não disponível');
      }

      // Cria o agendamento
      const appointment = await this.createAppointment(appointmentData, client);

      // Log de sucesso
      Logger.appointment('Appointment booked successfully', {
        appointmentId: appointment.id,
        clientId,
        barberId,
        date: formatDateTime(date),
        time
      });

      await client.query('COMMIT');
      return appointment;

    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error booking appointment', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Valida requisição de agendamento
   */
  async validateBookingRequest(appointmentData, client = null) {
    const { clientId, barberId, serviceId, date, time } = appointmentData;

    // Validações básicas
    if (!clientId || !barberId || !serviceId || !date || !time) {
      throw AppError.badRequest('Dados obrigatórios não fornecidos');
    }

    // Valida data e hora
    const appointmentDateTime = new Date(`${date}T${time}`);
    if (!isValidDateTime(appointmentDateTime)) {
      throw AppError.badRequest('Data ou horário inválido');
    }

    // Verifica se não é no passado
    const now = new Date();
    if (appointmentDateTime <= now) {
      throw AppError.badRequest('Não é possível agendar para o passado');
    }

    // Verifica se cliente existe
    const clientQuery = client || this.db;
    const clientResult = await clientQuery.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND role = $2',
      [clientId, 'client']
    );
    
    if (clientResult.rows.length === 0) {
      throw AppError.notFound('Cliente não encontrado');
    }

    if (!clientResult.rows[0].is_active) {
      throw AppError.badRequest('Cliente inativo');
    }

    // Verifica se barbeiro existe e está ativo
    const barberResult = await clientQuery.query(
      'SELECT id, is_active FROM users WHERE id = $1 AND role = $2',
      [barberId, 'barber']
    );
    
    if (barberResult.rows.length === 0) {
      throw AppError.notFound('Barbeiro não encontrado');
    }

    if (!barberResult.rows[0].is_active) {
      throw AppError.badRequest('Barbeiro inativo');
    }

    // Verifica se serviço existe e está ativo
    const serviceResult = await clientQuery.query(
      'SELECT id, is_active, duration FROM services WHERE id = $1',
      [serviceId]
    );
    
    if (serviceResult.rows.length === 0) {
      throw AppError.notFound('Serviço não encontrado');
    }

    if (!serviceResult.rows[0].is_active) {
      throw AppError.badRequest('Serviço indisponível');
    }

    // Verifica se cliente já tem agendamento no mesmo dia
    const existingAppointmentResult = await clientQuery.query(
      `SELECT id FROM appointments 
       WHERE client_id = $1 AND DATE(scheduled_at) = $2 AND status != $3`,
      [clientId, date, 'cancelled']
    );

    if (existingAppointmentResult.rows.length > 0) {
      throw AppError.conflict('Cliente já possui agendamento nesta data');
    }
  }

  /**
   * Verifica disponibilidade de um slot específico
   */
  async checkSlotAvailability(barberId, date, time, serviceId, client = null) {
    try {
      const queryClient = client || this.db;
      
      // Busca duração do serviço
      const serviceResult = await queryClient.query(
        'SELECT duration FROM services WHERE id = $1',
        [serviceId]
      );
      
      const serviceDuration = serviceResult.rows[0]?.duration || APPOINTMENT_SLOT_DURATION;
      
      // Busca agendamentos que possam conflitar
      const appointmentDateTime = new Date(`${date}T${time}`);
      const endDateTime = addMinutes(appointmentDateTime, serviceDuration + BUFFER_TIME);
      
      const conflictResult = await queryClient.query(
        `SELECT id FROM appointments 
         WHERE barber_id = $1 
         AND DATE(scheduled_at) = $2 
         AND status NOT IN ($3, $4)
         AND (
           scheduled_at < $5 AND 
           (scheduled_at + INTERVAL '1 minute' * (duration + $6)) > $7
         )`,
        [
          barberId, 
          date, 
          'cancelled', 
          'completed',
          endDateTime.toISOString(),
          BUFFER_TIME,
          appointmentDateTime.toISOString()
        ]
      );

      return conflictResult.rows.length === 0;
      
    } catch (error) {
      Logger.error('Error checking slot availability', error);
      return false;
    }
  }

  /**
   * Cria um novo agendamento
   */
  async createAppointment(appointmentData, client) {
    const { 
      clientId, 
      barberId, 
      serviceId, 
      date, 
      time, 
      notes = null 
    } = appointmentData;

    // Busca informações do serviço para definir preço e duração
    const serviceResult = await client.query(
      'SELECT price, duration FROM services WHERE id = $1',
      [serviceId]
    );
    
    const service = serviceResult.rows[0];
    const scheduledAt = new Date(`${date}T${time}`);

    const result = await client.query(
      `INSERT INTO appointments (
        client_id, barber_id, service_id, scheduled_at, 
        duration, price, notes, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
      RETURNING *`,
      [
        clientId,
        barberId, 
        serviceId,
        scheduledAt,
        service.duration || APPOINTMENT_SLOT_DURATION,
        service.price,
        notes,
        'scheduled'
      ]
    );

    return result.rows[0];
  }

  // =====================================================
  // MÉTODOS AUXILIARES
  // =====================================================

  async getBarberById(barberId) {
    const result = await this.db.query(
      'SELECT id, name, is_active FROM users WHERE id = $1 AND role = $2',
      [barberId, 'barber']
    );
    return result.rows[0] || null;
  }

  async getServiceById(serviceId) {
    const result = await this.db.query(
      'SELECT id, name, duration, price, is_active FROM services WHERE id = $1',
      [serviceId]
    );
    return result.rows[0] || null;
  }

  async getExistingAppointments(barberId, date) {
    const result = await this.db.query(
      `SELECT 
        TIME(scheduled_at) as time,
        duration
      FROM appointments 
      WHERE barber_id = $1 
      AND DATE(scheduled_at) = $2 
      AND status NOT IN ('cancelled', 'completed')
      ORDER BY scheduled_at`,
      [barberId, date]
    );
    return result.rows;
  }

  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

module.exports = { AdvancedSchedulingService };