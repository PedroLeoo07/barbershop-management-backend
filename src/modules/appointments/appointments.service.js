// =====================================================
// SERVICE DE AGENDAMENTOS PROFISSIONAL 
// =====================================================

const { AppointmentsRepository } = require('./appointments.repository');
const { SlotsGeneratorService } = require('./slots-generator.service');
const { AppError } = require('../../shared/errors/AppError');
const { Logger } = require('../../shared/utils/Logger');

class AppointmentsService {
  constructor(pool) {
    this.repository = new AppointmentsRepository(pool);
    this.slotsGenerator = new SlotsGeneratorService();
  }

  // =====================================================
  // 🔥 CRIAÇÃO PROFISSIONAL COM VALIDAÇÃO TOTAL
  // =====================================================

  async createAppointment(appointmentData, requestingUserId, userRole) {
    try {
      const {
        user_id,
        barber_id,
        service_id,
        appointment_date,
        appointment_time,
        duration = 30
      } = appointmentData;

      Logger.appointment('Starting professional appointment creation', {
        user_id,
        barber_id,
        service_id,
        appointment_date,
        appointment_time,
        duration,
        requestingUserId,
        userRole
      });

      // 1️⃣ VALIDAÇÕES DE PERMISSÃO
      await this.validatePermissions(appointmentData, requestingUserId, userRole);

      // 2️⃣ VALIDAÇÕES DE NEGÓCIO
      await this.validateBusinessRules(appointmentData);

      // 3️⃣ VALIDAÇÃO DE DISPONIBILIDADE (DUPLA VERIFICAÇÃO)
      await this.validateAvailability(barber_id, appointment_date, appointment_time, duration);

      // 4️⃣ CRIAÇÃO COM LOCK SQL
      const appointment = await this.repository.createWithLock({
        user_id,
        barber_id,
        service_id,
        appointment_date,
        appointment_time,
        duration
      });

      Logger.appointment('Professional appointment created successfully', {
        appointmentId: appointment.id,
        user_id,
        barber_id,
        appointment_date,
        appointment_time
      });

      // 5️⃣ RETORNA AGENDAMENTO COMPLETO
      return await this.repository.findByIdWithDetails(appointment.id);

    } catch (error) {
      Logger.appointment('Failed to create professional appointment', {
        appointmentData,
        requestingUserId,
        error: error.message
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Erro ao criar agendamento', 500);
    }
  }

  // =====================================================
  // 📅 GERAÇÃO DE HORÁRIOS DISPONÍVEIS
  // =====================================================

  async getAvailableSlots(barberId, date, serviceDuration = 30, config = {}) {
    try {
      Logger.appointment('Generating available slots', {
        barberId,
        date,
        serviceDuration
      });

      // 1️⃣ Gerar todos os slots possíveis
      const allSlots = this.slotsGenerator.generateSlots(date, serviceDuration, config);

      // 2️⃣ Filtrar slots disponíveis (remove ocupados)
      const availableSlots = await this.slotsGenerator.filterAvailableSlots(
        allSlots,
        barberId,
        date,
        this.repository
      );

      // 3️⃣ Estatísticas de disponibilidade
      const stats = this.slotsGenerator.calculateAvailabilityStats(availableSlots);

      Logger.appointment('Available slots generated', {
        barberId,
        date,
        totalSlots: allSlots.length,
        availableCount: stats.available,
        occupancyRate: stats.occupancyRate
      });

      return {
        date,
        barberId,
        serviceDuration,
        slots: availableSlots,
        statistics: stats,
        businessHours: {
          open: '09:00',
          close: '18:00',
          lunchBreak: '12:00 - 13:00'
        }
      };

    } catch (error) {
      Logger.appointment('Error generating available slots', {
        barberId,
        date,
        error: error.message
      });

      throw new AppError('Erro ao gerar horários disponíveis', 500);
    }
  }

  // =====================================================
  // 🔍 BUSCAR PRÓXIMO HORÁRIO DISPONÍVEL
  // =====================================================

  async findNextAvailable(barberId, serviceDuration = 30) {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const nextSlot = await this.slotsGenerator.findNextAvailable(
        barberId,
        tomorrow, // Começa buscando a partir de amanhã
        serviceDuration,
        this.repository
      );

      if (!nextSlot) {
        return {
          available: false,
          message: 'Nenhum horário disponível nos próximos 30 dias',
          suggestedAction: 'Entre na lista de espera ou tente outro barbeiro'
        };
      }

      return {
        available: true,
        date: nextSlot.date,
        time: nextSlot.slot.time,
        slot: nextSlot.slot,
        daysFromNow: nextSlot.daysFromNow,
        message: nextSlot.daysFromNow === 0 
          ? 'Disponível hoje' 
          : `Disponível em ${nextSlot.daysFromNow} dias`
      };

    } catch (error) {
      Logger.appointment('Error finding next available slot', {
        barberId,
        serviceDuration,
        error: error.message
      });

      throw new AppError('Erro ao buscar próximo horário', 500);
    }
  }

  // =====================================================
  // 📊 DASHBOARD DE AGENDAMENTOS
  // =====================================================

  async getDashboardData(barberId = null, startDate = null, endDate = null) {
    try {
      const today = new Date();
      const start = startDate || today.toISOString().split('T')[0];
      const end = endDate || today.toISOString().split('T')[0];

      let stats;
      if (barberId) {
        stats = await this.repository.getBarberStats(barberId, start, end);
      } else {
        // Se não especificar barbeiro, busca estatísticas gerais
        stats = await this.getAllBarbersStats(start, end);
      }

      // Busca agendamentos do dia
      const todayAppointments = barberId 
        ? await this.repository.findByBarberAndDate(barberId, start)
        : await this.getAllTodayAppointments(start);

      return {
        date: start,
        barberId,
        statistics: stats,
        todayAppointments: todayAppointments.map(apt => ({
          id: apt.id,
          time: apt.appointment_time,
          clientName: apt.client_name,
          serviceName: apt.service_name,
          status: apt.status,
          duration: apt.duration || apt.service_duration
        })),
        summary: {
          totalToday: todayAppointments.length,
          completedToday: todayAppointments.filter(apt => apt.status === 'COMPLETED').length,
          pendingToday: todayAppointments.filter(apt => apt.status === 'SCHEDULED').length,
          revenue: stats.total_revenue
        }
      };

    } catch (error) {
      Logger.appointment('Error getting dashboard data', {
        barberId,
        startDate,
        endDate,
        error: error.message
      });

      throw new AppError('Erro ao carregar dashboard', 500);
    }
  }

  // =====================================================
  // 🔄 ATUALIZAR STATUS DO AGENDAMENTO
  // =====================================================

  async updateAppointmentStatus(appointmentId, newStatus, notes = null, requestingUserId, userRole) {
    try {
      // Busca o agendamento atual
      const appointment = await this.repository.findByIdWithDetails(appointmentId);
      if (!appointment) {
        throw new AppError('Agendamento não encontrado', 404);
      }

      // Validações de permissão para atualização
      await this.validateUpdatePermissions(appointment, requestingUserId, userRole, newStatus);

      // Validações de transição de status
      this.validateStatusTransition(appointment.status, newStatus);

      // Atualiza o status
      const updatedAppointment = await this.repository.updateStatus(appointmentId, newStatus, notes);

      Logger.appointment('Appointment status updated', {
        appointmentId,
        oldStatus: appointment.status,
        newStatus,
        updatedBy: requestingUserId,
        userRole
      });

      return await this.repository.findByIdWithDetails(appointmentId);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      Logger.appointment('Error updating appointment status', {
        appointmentId,
        newStatus,
        error: error.message
      });

      throw new AppError('Erro ao atualizar status do agendamento', 500);
    }
  }

  // =====================================================
  // 🔍 BUSCAR AGENDAMENTOS COM FILTROS
  // =====================================================

  async findAppointments(filters = {}, pagination = { page: 1, limit: 20 }) {
    try {
      const { barberId, userId, status, startDate, endDate } = filters;
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      Logger.appointment('Searching appointments with filters', {
        filters,
        pagination
      });

      // Query base
      let query = `
        SELECT 
          a.*,
          u.name as client_name,
          u.email as client_email,
          b.name as barber_name,
          s.name as service_name,
          s.price as service_price
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        JOIN users b ON a.barber_id = b.id
        JOIN services s ON a.service_id = s.id
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 0;

      // Adiciona filtros dinamicamente
      if (barberId) {
        params.push(barberId);
        query += ` AND a.barber_id = $${++paramCount}`;
      }

      if (userId) {
        params.push(userId);
        query += ` AND a.user_id = $${++paramCount}`;
      }

      if (status) {
        params.push(status);
        query += ` AND a.status = $${++paramCount}`;
      }

      if (startDate) {
        params.push(startDate);
        query += ` AND a.appointment_date >= $${++paramCount}`;
      }

      if (endDate) {
        params.push(endDate);
        query += ` AND a.appointment_date <= $${++paramCount}`;
      }

      // Ordenação e paginação
      query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
      
      params.push(limit, offset);
      query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;

      const result = await this.repository.pool.query(query, params);

      // Query para contar total
      let countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
      countQuery = countQuery.replace(/ORDER BY.*/, '').replace(/LIMIT.*/, '');
      
      const countResult = await this.repository.pool.query(
        countQuery, 
        params.slice(0, -2) // Remove limit e offset
      );

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        appointments: result.rows,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      Logger.appointment('Error searching appointments', {
        filters,
        pagination,
        error: error.message
      });

      throw new AppError('Erro ao buscar agendamentos', 500);
    }
  }

  // =====================================================
  // 🛡️ VALIDAÇÕES PRIVADAS
  // =====================================================

  async validatePermissions(appointmentData, requestingUserId, userRole) {
    const { user_id, barber_id } = appointmentData;

    switch (userRole) {
      case 'admin':
        // Admin pode agendar para qualquer um
        return true;

      case 'barber':
        // Barbeiro só pode agendar no próprio horário
        if (barber_id !== requestingUserId) {
          throw new AppError('Barbeiro só pode agendar em seus próprios horários', 403);
        }
        return true;

      case 'client':
        // Cliente só pode agendar para si mesmo
        if (user_id !== requestingUserId) {
          throw new AppError('Cliente só pode agendar para si mesmo', 403);
        }
        return true;

      default:
        throw new AppError('Papel de usuário inválido', 403);
    }
  }

  async validateBusinessRules(appointmentData) {
    const { appointment_date, appointment_time } = appointmentData;

    // Não permite agendamento no passado
    const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
    const now = new Date();

    if (appointmentDateTime <= now) {
      throw new AppError('Não é possível agendar no passado', 400);
    }

    // Não permite agendamento com mais de 60 dias de antecedência
    const maxAdvanceMs = 60 * 24 * 60 * 60 * 1000; // 60 dias em ms
    if (appointmentDateTime.getTime() - now.getTime() > maxAdvanceMs) {
      throw new AppError('Não é possível agendar com mais de 60 dias de antecedência', 400);
    }

    return true;
  }

  async validateAvailability(barberId, date, time, duration) {
    const conflicts = await this.repository.findConflicts(barberId, date, time, duration);
    
    if (conflicts.length > 0) {
      throw new AppError('Horário não disponível - conflito detectado', 409);
    }

    return true;
  }

  async validateUpdatePermissions(appointment, requestingUserId, userRole, newStatus) {
    switch (userRole) {
      case 'admin':
        // Admin pode atualizar qualquer agendamento
        return true;

      case 'barber':
        // Barbeiro só pode atualizar agendamentos dele
        if (appointment.barber_id !== requestingUserId) {
          throw new AppError('Barbeiro só pode atualizar próprios agendamentos', 403);
        }
        return true;

      case 'client':
        // Cliente só pode cancelar próprios agendamentos
        if (appointment.user_id !== requestingUserId) {
          throw new AppError('Cliente só pode atualizar próprios agendamentos', 403);
        }
        if (newStatus !== 'CANCELLED') {
          throw new AppError('Cliente só pode cancelar agendamentos', 403);
        }
        return true;

      default:
        throw new AppError('Papel de usuário inválido', 403);
    }
  }

  validateStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = {
      'SCHEDULED': ['CONFIRMED', 'CANCELLED', 'IN_PROGRESS'],
      'CONFIRMED': ['COMPLETED', 'CANCELLED', 'IN_PROGRESS'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [], // Status final
      'CANCELLED': [] // Status final
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new AppError(`Transição de status inválida: ${currentStatus} → ${newStatus}`, 400);
    }

    return true;
  }
}

module.exports = { AppointmentsService };