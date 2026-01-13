import { Request, Response } from 'express';
import { AppointmentService } from '../services/appointmentService';
import { ResponseService, ErrorMessages } from '../utils/responses';

export class AppointmentController {
  /**
   * Criar novo agendamento
   */
  static async createAppointment(req: Request, res: Response): Promise<void> {
    try {
      const appointmentData = req.validatedData;
      
      // Se não foi fornecido client_id, usar do token (para clientes)
      if (!appointmentData.client_id && req.user?.role === 'CLIENT') {
        appointmentData.client_id = req.user.user_id;
      }
      
      const appointment = await AppointmentService.createAppointment(appointmentData);
      
      const { response, statusCode } = ResponseService.created(
        ErrorMessages.APPOINTMENT_CREATED,
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Create appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message.includes('não encontrado')) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.APPOINTMENT_CONFLICT) {
        message = error.message;
        statusCode = 409;
      } else if (error.message === ErrorMessages.APPOINTMENT_PAST_DATE) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Buscar agendamento por ID
   */
  static async getAppointmentById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const appointment = await AppointmentService.getAppointmentById(id);
      
      // Verificar permissão de acesso
      const userId = req.user!.user_id;
      const userRole = req.user!.role;
      
      const hasAccess = 
        userRole === 'ADMIN' ||
        appointment.client_id === userId ||
        appointment.barber?.user?.id === userId;
      
      if (!hasAccess) {
        const { response, statusCode } = ResponseService.forbidden();
        return res.status(statusCode).json(response);
      }
      
      const { response, statusCode } = ResponseService.success(
        'Agendamento encontrado',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Listar agendamentos com filtros
   */
  static async getAppointments(req: Request, res: Response): Promise<void> {
    try {
      const filters = req.validatedData?.query || {};
      const pagination = req.validatedData?.query || { page: 1, limit: 10 };
      const userId = req.user!.user_id;
      const userRole = req.user!.role;
      
      const result = await AppointmentService.getAppointments(
        filters,
        pagination,
        userId,
        userRole
      );
      
      const { response, statusCode } = ResponseService.paginated(
        'Agendamentos encontrados',
        result.appointments,
        {
          page: pagination.page,
          limit: pagination.limit,
          total: result.total,
        }
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get appointments error:', error);
      
      const { response, statusCode } = ResponseService.internalError();
      res.status(statusCode).json(response);
    }
  }

  /**
   * Atualizar agendamento
   */
  static async updateAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.validatedData;
      const userId = req.user!.user_id;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.updateAppointment(
        id,
        updateData,
        userId,
        userRole
      );
      
      const { response, statusCode } = ResponseService.success(
        ErrorMessages.APPOINTMENT_UPDATED,
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Update appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.ACCESS_DENIED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message === ErrorMessages.APPOINTMENT_CONFLICT) {
        message = error.message;
        statusCode = 409;
      } else if (error.message === ErrorMessages.APPOINTMENT_PAST_DATE) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Cancelar agendamento
   */
  static async cancelAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.user_id;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.cancelAppointment(
        id,
        userId,
        userRole
      );
      
      const { response, statusCode } = ResponseService.success(
        ErrorMessages.APPOINTMENT_CANCELLED,
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Cancel appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.ACCESS_DENIED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message.includes('cancelar')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Buscar slots disponíveis
   */
  static async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { date, service_id, barber_id } = req.validatedData?.query || req.query;
      
      const slots = await AppointmentService.getAvailableSlots({
        date,
        service_id,
        barber_id,
      });
      
      const { response, statusCode } = ResponseService.success(
        'Slots disponíveis encontrados',
        slots
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get available slots error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message.includes('não encontrado')) {
        message = error.message;
        statusCode = 404;
      } else if (error.message.includes('passadas')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Buscar agendamentos de hoje
   */
  static async getTodayAppointments(req: Request, res: Response): Promise<void> {
    try {
      const appointments = await AppointmentService.getTodayAppointments();
      
      const { response, statusCode } = ResponseService.success(
        'Agendamentos de hoje encontrados',
        appointments
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get today appointments error:', error);
      
      const { response, statusCode } = ResponseService.internalError();
      res.status(statusCode).json(response);
    }
  }

  /**
   * Confirmar agendamento
   */
  static async confirmAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.confirmAppointment(id, userRole);
      
      const { response, statusCode } = ResponseService.success(
        'Agendamento confirmado com sucesso',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Confirm appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.BARBER_OR_ADMIN_REQUIRED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message.includes('confirmar')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Iniciar atendimento
   */
  static async startAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.startAppointment(id, userRole);
      
      const { response, statusCode } = ResponseService.success(
        'Atendimento iniciado com sucesso',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Start appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.BARBER_OR_ADMIN_REQUIRED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message.includes('iniciar')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Finalizar atendimento
   */
  static async completeAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.completeAppointment(id, userRole);
      
      const { response, statusCode } = ResponseService.success(
        'Atendimento finalizado com sucesso',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Complete appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.BARBER_OR_ADMIN_REQUIRED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message.includes('finalizado')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Marcar como não compareceu
   */
  static async markAsNoShow(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.markAsNoShow(id, userRole);
      
      const { response, statusCode } = ResponseService.success(
        'Cliente marcado como não compareceu',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Mark as no show error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.BARBER_OR_ADMIN_REQUIRED) {
        message = error.message;
        statusCode = 403;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Reagendar agendamento
   */
  static async rescheduleAppointment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { appointment_date, start_time } = req.validatedData;
      const userId = req.user!.user_id;
      const userRole = req.user!.role;
      
      const appointment = await AppointmentService.rescheduleAppointment(
        id,
        appointment_date,
        start_time,
        userId,
        userRole
      );
      
      const { response, statusCode } = ResponseService.success(
        'Agendamento reagendado com sucesso',
        appointment
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Reschedule appointment error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.APPOINTMENT_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.ACCESS_DENIED) {
        message = error.message;
        statusCode = 403;
      } else if (error.message === ErrorMessages.APPOINTMENT_CONFLICT) {
        message = error.message;
        statusCode = 409;
      } else if (error.message.includes('reagendar')) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Buscar estatísticas de agendamentos
   */
  static async getAppointmentStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { start_date, end_date } = req.query;
      
      const stats = await AppointmentService.getAppointmentStatistics({
        startDate: start_date as string,
        endDate: end_date as string,
      });
      
      const { response, statusCode } = ResponseService.success(
        'Estatísticas de agendamentos',
        stats
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get appointment statistics error:', error);
      
      const { response, statusCode } = ResponseService.internalError();
      res.status(statusCode).json(response);
    }
  }
}