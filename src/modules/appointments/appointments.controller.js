// =====================================================
// CONTROLLER DE AGENDAMENTOS PROFISSIONAL 
// =====================================================

const { AppointmentsService } = require('./appointments.service');
const { AppError } = require('../../shared/errors/AppError');
const { Logger } = require('../../shared/utils/Logger');
const { successResponse, errorResponse } = require('../../shared/utils/responses');

class AppointmentsController {
  constructor(pool) {
    this.appointmentsService = new AppointmentsService(pool);
  }

  // =====================================================
  // 🔥 CRIAR AGENDAMENTO (FLUXO PROFISSIONAL)
  // =====================================================

  createAppointment = async (req, res, next) => {
    try {
      const appointmentData = req.body;
      const { id: requestingUserId, role: userRole } = req.user;

      Logger.appointment('Appointment creation requested', {
        appointmentData,
        requestingUserId,
        userRole,
        ip: req.ip
      });

      // Backend manda em tudo - validação total
      const appointment = await this.appointmentsService.createAppointment(
        appointmentData,
        requestingUserId,
        userRole
      );

      Logger.appointment('Appointment created successfully', {
        appointmentId: appointment.id,
        requestingUserId
      });

      return successResponse(res, appointment, 'Agendamento criado com sucesso', 201);

    } catch (error) {
      Logger.appointment('Failed to create appointment', {
        requestingUserId: req.user?.id,
        error: error.message,
        stack: error.stack
      });

      next(error);
    }
  };

  // =====================================================
  // 📅 BUSCAR HORÁRIOS DISPONÍVEIS
  // =====================================================

  getAvailableSlots = async (req, res, next) => {
    try {
      const { barberId, date } = req.params;
      const { serviceDuration = 30, serviceId } = req.query;

      // Se serviceId foi fornecido, busca a duração real do serviço
      let actualDuration = parseInt(serviceDuration);
      if (serviceId) {
        // Aqui você buscaria a duração do serviço no banco
        // const service = await serviceRepository.findById(serviceId);
        // actualDuration = service.duration;
      }

      Logger.appointment('Available slots requested', {
        barberId,
        date,
        serviceDuration: actualDuration,
        requestingUserId: req.user?.id
      });

      const slotsData = await this.appointmentsService.getAvailableSlots(
        barberId,
        date,
        actualDuration
      );

      return successResponse(res, slotsData, 'Horários disponíveis recuperados');

    } catch (error) {
      Logger.appointment('Failed to get available slots', {
        barberId: req.params.barberId,
        date: req.params.date,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 🔍 BUSCAR PRÓXIMO HORÁRIO DISPONÍVEL
  // =====================================================

  getNextAvailable = async (req, res, next) => {
    try {
      const { barberId } = req.params;
      const { serviceDuration = 30 } = req.query;

      Logger.appointment('Next available slot requested', {
        barberId,
        serviceDuration,
        requestingUserId: req.user?.id
      });

      const nextSlot = await this.appointmentsService.findNextAvailable(
        barberId,
        parseInt(serviceDuration)
      );

      return successResponse(res, nextSlot, 'Próximo horário disponível encontrado');

    } catch (error) {
      Logger.appointment('Failed to find next available slot', {
        barberId: req.params.barberId,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 📊 DASHBOARD DE AGENDAMENTOS
  // =====================================================

  getDashboard = async (req, res, next) => {
    try {
      const { barberId } = req.query;
      const { startDate, endDate } = req.query;
      const { id: requestingUserId, role: userRole } = req.user;

      // Se for barbeiro, só pode ver próprio dashboard
      let targetBarberId = barberId;
      if (userRole === 'barber') {
        targetBarberId = requestingUserId;
      }

      Logger.appointment('Dashboard requested', {
        barberId: targetBarberId,
        startDate,
        endDate,
        requestingUserId,
        userRole
      });

      const dashboardData = await this.appointmentsService.getDashboardData(
        targetBarberId,
        startDate,
        endDate
      );

      return successResponse(res, dashboardData, 'Dashboard carregado');

    } catch (error) {
      Logger.appointment('Failed to load dashboard', {
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 📋 LISTAR AGENDAMENTOS COM FILTROS
  // =====================================================

  getAppointments = async (req, res, next) => {
    try {
      const {
        barberId,
        userId,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = req.query;

      const { id: requestingUserId, role: userRole } = req.user;

      // Aplicar filtros baseados no papel do usuário
      let filters = { barberId, userId, status, startDate, endDate };
      
      if (userRole === 'barber') {
        // Barbeiro só vê próprios agendamentos
        filters.barberId = requestingUserId;
      } else if (userRole === 'client') {
        // Cliente só vê próprios agendamentos
        filters.userId = requestingUserId;
      }

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100) // Máximo 100 por página
      };

      Logger.appointment('Appointments list requested', {
        filters,
        pagination,
        requestingUserId,
        userRole
      });

      const result = await this.appointmentsService.findAppointments(filters, pagination);

      return successResponse(res, result, 'Agendamentos encontrados');

    } catch (error) {
      Logger.appointment('Failed to list appointments', {
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 🔍 BUSCAR AGENDAMENTO POR ID
  // =====================================================

  getAppointmentById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { id: requestingUserId, role: userRole } = req.user;

      const appointment = await this.appointmentsService.repository.findByIdWithDetails(id);

      if (!appointment) {
        throw new AppError('Agendamento não encontrado', 404);
      }

      // Verificar permissões de visualização
      if (userRole === 'barber' && appointment.barber_id !== requestingUserId) {
        throw new AppError('Sem permissão para ver este agendamento', 403);
      }

      if (userRole === 'client' && appointment.user_id !== requestingUserId) {
        throw new AppError('Sem permissão para ver este agendamento', 403);
      }

      Logger.appointment('Appointment details requested', {
        appointmentId: id,
        requestingUserId,
        userRole
      });

      return successResponse(res, appointment, 'Agendamento encontrado');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔄 ATUALIZAR STATUS DO AGENDAMENTO
  // =====================================================

  updateAppointmentStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const { id: requestingUserId, role: userRole } = req.user;

      Logger.appointment('Appointment status update requested', {
        appointmentId: id,
        newStatus: status,
        notes,
        requestingUserId,
        userRole
      });

      const updatedAppointment = await this.appointmentsService.updateAppointmentStatus(
        id,
        status,
        notes,
        requestingUserId,
        userRole
      );

      return successResponse(res, updatedAppointment, `Agendamento ${status.toLowerCase()}`);

    } catch (error) {
      Logger.appointment('Failed to update appointment status', {
        appointmentId: req.params.id,
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // ❌ CANCELAR AGENDAMENTO
  // =====================================================

  cancelAppointment = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const { id: requestingUserId, role: userRole } = req.user;

      Logger.appointment('Appointment cancellation requested', {
        appointmentId: id,
        reason,
        requestingUserId,
        userRole
      });

      const cancelledAppointment = await this.appointmentsService.updateAppointmentStatus(
        id,
        'CANCELLED',
        reason,
        requestingUserId,
        userRole
      );

      return successResponse(res, cancelledAppointment, 'Agendamento cancelado');

    } catch (error) {
      Logger.appointment('Failed to cancel appointment', {
        appointmentId: req.params.id,
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // ✅ CONFIRMAR AGENDAMENTO
  // =====================================================

  confirmAppointment = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { id: requestingUserId, role: userRole } = req.user;

      Logger.appointment('Appointment confirmation requested', {
        appointmentId: id,
        requestingUserId,
        userRole
      });

      const confirmedAppointment = await this.appointmentsService.updateAppointmentStatus(
        id,
        'CONFIRMED',
        'Agendamento confirmado',
        requestingUserId,
        userRole
      );

      return successResponse(res, confirmedAppointment, 'Agendamento confirmado');

    } catch (error) {
      Logger.appointment('Failed to confirm appointment', {
        appointmentId: req.params.id,
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 🏁 COMPLETAR AGENDAMENTO
  // =====================================================

  completeAppointment = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const { id: requestingUserId, role: userRole } = req.user;

      Logger.appointment('Appointment completion requested', {
        appointmentId: id,
        notes,
        requestingUserId,
        userRole
      });

      const completedAppointment = await this.appointmentsService.updateAppointmentStatus(
        id,
        'COMPLETED',
        notes || 'Serviço realizado',
        requestingUserId,
        userRole
      );

      return successResponse(res, completedAppointment, 'Agendamento concluído');

    } catch (error) {
      Logger.appointment('Failed to complete appointment', {
        appointmentId: req.params.id,
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 📅 AGENDAMENTOS DO DIA
  // =====================================================

  getTodayAppointments = async (req, res, next) => {
    try {
      const { id: requestingUserId, role: userRole } = req.user;
      const today = new Date().toISOString().split('T')[0];

      let barberId = null;
      if (userRole === 'barber') {
        barberId = requestingUserId;
      }

      const filters = {
        barberId,
        startDate: today,
        endDate: today
      };

      Logger.appointment('Today appointments requested', {
        filters,
        requestingUserId,
        userRole
      });

      const result = await this.appointmentsService.findAppointments(filters, { page: 1, limit: 100 });

      return successResponse(res, {
        date: today,
        appointments: result.appointments,
        total: result.appointments.length
      }, 'Agendamentos de hoje');

    } catch (error) {
      Logger.appointment('Failed to get today appointments', {
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };

  // =====================================================
  // 📊 ESTATÍSTICAS RÁPIDAS
  // =====================================================

  getQuickStats = async (req, res, next) => {
    try {
      const { id: requestingUserId, role: userRole } = req.user;
      const { period = 'today' } = req.query;

      let startDate, endDate;
      const today = new Date();

      switch (period) {
        case 'today':
          startDate = endDate = today.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          startDate = weekStart.toISOString().split('T')[0];
          endDate = today.toISOString().split('T')[0];
          break;
        case 'month':
          startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = today.toISOString().split('T')[0];
          break;
        default:
          startDate = endDate = today.toISOString().split('T')[0];
      }

      let barberId = null;
      if (userRole === 'barber') {
        barberId = requestingUserId;
      }

      const dashboardData = await this.appointmentsService.getDashboardData(
        barberId,
        startDate,
        endDate
      );

      return successResponse(res, {
        period,
        startDate,
        endDate,
        stats: dashboardData.statistics,
        summary: dashboardData.summary
      }, 'Estatísticas rápidas');

    } catch (error) {
      Logger.appointment('Failed to get quick stats', {
        requestingUserId: req.user?.id,
        error: error.message
      });

      next(error);
    }
  };
}

module.exports = { AppointmentsController };