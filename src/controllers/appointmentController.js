// =====================================================
// CONTROLLER DE AGENDAMENTOS
// =====================================================

const { AppointmentService } = require('../services/appointmentService');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');
const { successResponse, errorResponse } = require('../utils/responses');

class AppointmentController {
  constructor(db) {
    this.appointmentService = new AppointmentService(db);
  }

  // =====================================================
  // CRIAÇÃO DE AGENDAMENTOS
  // =====================================================

  createAppointment = async (req, res, next) => {
    try {
      const { user } = req;
      const appointmentData = req.body;

      Logger.appointment('Create appointment request', {
        userId: user.id,
        userRole: user.role,
        appointmentData
      });

      const appointment = await this.appointmentService.createAppointment(
        appointmentData,
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento criado com sucesso', 201);

    } catch (error) {
      Logger.error('Error in createAppointment controller', error);
      next(error);
    }
  };

  // =====================================================
  // CONSULTA DE AGENDAMENTOS
  // =====================================================

  getAppointmentById = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;

      const appointment = await this.appointmentService.getAppointmentById(
        parseInt(id),
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento encontrado');

    } catch (error) {
      Logger.error('Error in getAppointmentById controller', error);
      next(error);
    }
  };

  getMyAppointments = async (req, res, next) => {
    try {
      const { user } = req;
      const {
        page = 1,
        limit = 10,
        includeCompleted = 'true',
        includeCancelled = 'false'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        includeCompleted: includeCompleted === 'true',
        includeCancelled: includeCancelled === 'true'
      };

      let appointments;

      if (user.role === 'client') {
        appointments = await this.appointmentService.getAppointmentsByClient(
          user.id,
          options,
          user.id,
          user.role
        );
      } else if (user.role === 'barber') {
        appointments = await this.appointmentService.getAppointmentsByBarber(
          user.id,
          options,
          user.id,
          user.role
        );
      } else {
        throw AppError.badRequest('Role não suportado para esta operação');
      }

      return successResponse(res, appointments, 'Agendamentos encontrados');

    } catch (error) {
      Logger.error('Error in getMyAppointments controller', error);
      next(error);
    }
  };

  getAppointmentsByClient = async (req, res, next) => {
    try {
      const { user } = req;
      const { clientId } = req.params;
      const {
        page = 1,
        limit = 10,
        includeCompleted = 'true',
        includeCancelled = 'false'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        includeCompleted: includeCompleted === 'true',
        includeCancelled: includeCancelled === 'true'
      };

      const appointments = await this.appointmentService.getAppointmentsByClient(
        parseInt(clientId),
        options,
        user.id,
        user.role
      );

      return successResponse(res, appointments, 'Agendamentos do cliente encontrados');

    } catch (error) {
      Logger.error('Error in getAppointmentsByClient controller', error);
      next(error);
    }
  };

  getAppointmentsByBarber = async (req, res, next) => {
    try {
      const { user } = req;
      const { barberId } = req.params;
      const {
        date = null,
        page = 1,
        limit = 10,
        includeCompleted = 'true',
        includeCancelled = 'false'
      } = req.query;

      const options = {
        date,
        page: parseInt(page),
        limit: parseInt(limit),
        includeCompleted: includeCompleted === 'true',
        includeCancelled: includeCancelled === 'true'
      };

      const appointments = await this.appointmentService.getAppointmentsByBarber(
        parseInt(barberId),
        options,
        user.id,
        user.role
      );

      return successResponse(res, appointments, 'Agendamentos do barbeiro encontrados');

    } catch (error) {
      Logger.error('Error in getAppointmentsByBarber controller', error);
      next(error);
    }
  };

  getAppointmentsByDate = async (req, res, next) => {
    try {
      const { date } = req.params;
      const { barberId } = req.query;

      const appointments = await this.appointmentService.getAppointmentsByDate(
        date,
        barberId ? parseInt(barberId) : null
      );

      return successResponse(res, appointments, 'Agendamentos por data encontrados');

    } catch (error) {
      Logger.error('Error in getAppointmentsByDate controller', error);
      next(error);
    }
  };

  getUpcomingAppointments = async (req, res, next) => {
    try {
      const { user } = req;
      const { limit = 20 } = req.query;

      let barberId = null;
      if (user.role === 'barber') {
        barberId = user.id;
      } else if (req.query.barberId) {
        barberId = parseInt(req.query.barberId);
      }

      const appointments = await this.appointmentService.getUpcomingAppointments(
        barberId,
        parseInt(limit)
      );

      return successResponse(res, appointments, 'Próximos agendamentos encontrados');

    } catch (error) {
      Logger.error('Error in getUpcomingAppointments controller', error);
      next(error);
    }
  };

  // =====================================================
  // ATUALIZAÇÃO DE AGENDAMENTOS
  // =====================================================

  updateAppointment = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;
      const updateData = req.body;

      Logger.appointment('Update appointment request', {
        appointmentId: id,
        userId: user.id,
        userRole: user.role,
        updateData
      });

      const appointment = await this.appointmentService.updateAppointment(
        parseInt(id),
        updateData,
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento atualizado com sucesso');

    } catch (error) {
      Logger.error('Error in updateAppointment controller', error);
      next(error);
    }
  };

  updateAppointmentStatus = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;
      const { status } = req.body;

      Logger.appointment('Update appointment status request', {
        appointmentId: id,
        newStatus: status,
        userId: user.id,
        userRole: user.role
      });

      const appointment = await this.appointmentService.updateAppointmentStatus(
        parseInt(id),
        status,
        user.id,
        user.role
      );

      return successResponse(res, appointment, `Agendamento ${status} com sucesso`);

    } catch (error) {
      Logger.error('Error in updateAppointmentStatus controller', error);
      next(error);
    }
  };

  // =====================================================
  // AÇÕES ESPECÍFICAS
  // =====================================================

  cancelAppointment = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;

      Logger.appointment('Cancel appointment request', {
        appointmentId: id,
        userId: user.id,
        userRole: user.role
      });

      const appointment = await this.appointmentService.cancelAppointment(
        parseInt(id),
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento cancelado com sucesso');

    } catch (error) {
      Logger.error('Error in cancelAppointment controller', error);
      next(error);
    }
  };

  confirmAppointment = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;

      Logger.appointment('Confirm appointment request', {
        appointmentId: id,
        userId: user.id,
        userRole: user.role
      });

      const appointment = await this.appointmentService.confirmAppointment(
        parseInt(id),
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento confirmado com sucesso');

    } catch (error) {
      Logger.error('Error in confirmAppointment controller', error);
      next(error);
    }
  };

  completeAppointment = async (req, res, next) => {
    try {
      const { user } = req;
      const { id } = req.params;

      Logger.appointment('Complete appointment request', {
        appointmentId: id,
        userId: user.id,
        userRole: user.role
      });

      const appointment = await this.appointmentService.completeAppointment(
        parseInt(id),
        user.id,
        user.role
      );

      return successResponse(res, appointment, 'Agendamento concluído com sucesso');

    } catch (error) {
      Logger.error('Error in completeAppointment controller', error);
      next(error);
    }
  };

  // =====================================================
  // HORÁRIOS DISPONÍVEIS
  // =====================================================

  getAvailableSlots = async (req, res, next) => {
    try {
      const { barberId, date } = req.params;
      const { serviceId } = req.query;

      Logger.appointment('Get available slots request', {
        barberId,
        date,
        serviceId
      });

      const slots = await this.appointmentService.getAvailableSlots(
        parseInt(barberId),
        date,
        serviceId ? parseInt(serviceId) : null
      );

      return successResponse(res, slots, 'Horários disponíveis encontrados');

    } catch (error) {
      Logger.error('Error in getAvailableSlots controller', error);
      next(error);
    }
  };

  // =====================================================
  // ESTATÍSTICAS E RELATÓRIOS
  // =====================================================

  getAppointmentStatistics = async (req, res, next) => {
    try {
      const { user } = req;
      const {
        barberId,
        startDate,
        endDate
      } = req.query;

      // Barbeiro só pode ver próprias estatísticas
      const options = {};
      if (user.role === 'barber') {
        options.barberId = user.id;
      } else if (barberId) {
        options.barberId = parseInt(barberId);
      }

      if (startDate) options.startDate = startDate;
      if (endDate) options.endDate = endDate;

      const stats = await this.appointmentService.getAppointmentStatistics(options);

      return successResponse(res, stats, 'Estatísticas de agendamentos');

    } catch (error) {
      Logger.error('Error in getAppointmentStatistics controller', error);
      next(error);
    }
  };

  getDashboardData = async (req, res, next) => {
    try {
      const { user } = req;

      let barberId = null;
      if (user.role === 'barber') {
        barberId = user.id;
      }

      // Busca dados em paralelo
      const [upcomingAppointments, statistics] = await Promise.all([
        this.appointmentService.getUpcomingAppointments(barberId, 5),
        this.appointmentService.getAppointmentStatistics({ barberId })
      ]);

      const dashboardData = {
        upcomingAppointments,
        statistics,
        userRole: user.role
      };

      return successResponse(res, dashboardData, 'Dados do dashboard');

    } catch (error) {
      Logger.error('Error in getDashboardData controller', error);
      next(error);
    }
  };
}

module.exports = { AppointmentController };