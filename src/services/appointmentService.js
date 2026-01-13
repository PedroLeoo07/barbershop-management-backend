// =====================================================
// SERVICE DE AGENDAMENTOS
// =====================================================

const { AppointmentRepository } = require('../repositories/appointmentRepository');
const { UserRepository } = require('../repositories/userRepository');
const { ServiceRepository } = require('../repositories/serviceRepository');
const { AdvancedSchedulingService } = require('./schedulingService');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');
const { cache } = require('../utils/cache');

class AppointmentService {
  constructor(db) {
    this.appointmentRepository = new AppointmentRepository(db);
    this.userRepository = new UserRepository(db);
    this.serviceRepository = new ServiceRepository(db);
    this.schedulingService = new AdvancedSchedulingService(db);
  }

  // =====================================================
  // CRIAÇÃO DE AGENDAMENTOS
  // =====================================================

  async createAppointment(appointmentData, userId = null, userRole = null) {
    try {
      const { client_id, barber_id, service_id, scheduled_at } = appointmentData;

      Logger.appointment('Creating appointment', {
        client_id,
        barber_id,
        service_id,
        scheduled_at,
        requestedBy: userId
      });

      // Validações de permissão
      await this.validateCreatePermissions(appointmentData, userId, userRole);

      // Validações de negócio
      await this.validateBusinessRules(appointmentData);

      // Busca informações do serviço para definir duração e preço
      const service = await this.serviceRepository.findById(service_id);
      if (!service || !service.is_active) {
        throw AppError.notFound('Serviço não encontrado ou indisponível');
      }

      // Prepara dados completos do agendamento
      const appointmentToCreate = {
        client_id,
        barber_id,
        service_id,
        scheduled_at: new Date(scheduled_at),
        duration: service.duration,
        price: service.price,
        notes: appointmentData.notes || null
      };

      // Cria o agendamento com transação e validações
      const appointment = await this.appointmentRepository.createWithValidation(appointmentToCreate);
      
      // Invalida caches relacionados
      cache.invalidateAppointment(appointment.id, barber_id, scheduled_at.split('T')[0]);

      Logger.appointment('Appointment created successfully', {
        appointmentId: appointment.id,
        barberId: barber_id,
        scheduledAt: scheduled_at
      });

      return appointment;
      
    } catch (error) {
      Logger.error('Error creating appointment', error);
      throw error;
    }
  }

  // =====================================================
  // CONSULTA DE AGENDAMENTOS
  // =====================================================

  async getAppointmentById(id, userId = null, userRole = null) {
    try {
      // Verifica cache primeiro
      const cached = cache.getAppointment(id);
      if (cached) {
        await this.validateViewPermissions(cached, userId, userRole);
        return cached;
      }

      const appointment = await this.appointmentRepository.findByIdWithDetails(id);
      
      if (!appointment) {
        throw AppError.notFound('Agendamento não encontrado');
      }

      // Validações de permissão
      await this.validateViewPermissions(appointment, userId, userRole);

      // Salva no cache
      cache.setAppointment(id, appointment);

      return appointment;
      
    } catch (error) {
      Logger.error('Error getting appointment by id', { appointmentId: id, error });
      throw error;
    }
  }

  async getAppointmentsByClient(clientId, options = {}, requestUserId = null, userRole = null) {
    try {
      // Validações de permissão
      if (userRole !== 'admin' && requestUserId !== clientId) {
        throw AppError.forbidden('Acesso negado: você só pode ver seus próprios agendamentos');
      }

      const {
        page = 1,
        limit = 10,
        includeCompleted = true,
        includeCancelled = false
      } = options;

      const result = await this.appointmentRepository.paginate(
        { client_id: clientId },
        page,
        limit,
        { includeCompleted, includeCancelled }
      );

      return result;
      
    } catch (error) {
      Logger.error('Error getting appointments by client', { clientId, error });
      throw error;
    }
  }

  async getAppointmentsByBarber(barberId, options = {}, requestUserId = null, userRole = null) {
    try {
      // Validações de permissão
      if (userRole !== 'admin' && userRole !== 'barber') {
        throw AppError.forbidden('Acesso negado');
      }

      if (userRole === 'barber' && requestUserId !== barberId) {
        throw AppError.forbidden('Barbeiro só pode ver próprios agendamentos');
      }

      const appointments = await this.appointmentRepository.findByBarber(barberId, options);
      return appointments;
      
    } catch (error) {
      Logger.error('Error getting appointments by barber', { barberId, error });
      throw error;
    }
  }

  async getAppointmentsByDate(date, barberId = null) {
    try {
      const appointments = await this.appointmentRepository.findByDate(date, barberId);
      return appointments;
    } catch (error) {
      Logger.error('Error getting appointments by date', { date, barberId, error });
      throw error;
    }
  }

  // =====================================================
  // ATUALIZAÇÃO DE AGENDAMENTOS
  // =====================================================

  async updateAppointment(id, updateData, userId = null, userRole = null) {
    try {
      // Busca agendamento atual
      const existingAppointment = await this.appointmentRepository.findById(id);
      if (!existingAppointment) {
        throw AppError.notFound('Agendamento não encontrado');
      }

      // Validações de permissão
      await this.validateUpdatePermissions(existingAppointment, updateData, userId, userRole);

      // Se alterando horário, validar disponibilidade
      if (updateData.scheduled_at) {
        const conflicts = await this.appointmentRepository.findConflicting(
          existingAppointment.barber_id,
          updateData.scheduled_at,
          existingAppointment.duration,
          id
        );

        if (conflicts.length > 0) {
          throw AppError.conflict('Novo horário não disponível - conflito detectado');
        }
      }

      const updatedAppointment = await this.appointmentRepository.update(id, updateData);
      
      // Invalida caches
      cache.invalidateAppointment(
        id, 
        existingAppointment.barber_id,
        existingAppointment.scheduled_at.split('T')[0]
      );

      Logger.appointment('Appointment updated', {
        appointmentId: id,
        updatedFields: Object.keys(updateData),
        updatedBy: userId
      });

      return updatedAppointment;
      
    } catch (error) {
      Logger.error('Error updating appointment', { appointmentId: id, error });
      throw error;
    }
  }

  async updateAppointmentStatus(id, status, userId = null, userRole = null) {
    try {
      const existingAppointment = await this.appointmentRepository.findById(id);
      if (!existingAppointment) {
        throw AppError.notFound('Agendamento não encontrado');
      }

      // Validações de permissão para mudança de status
      await this.validateStatusChangePermissions(existingAppointment, status, userId, userRole);

      const updatedAppointment = await this.appointmentRepository.updateStatus(id, status);
      
      // Invalida caches
      cache.invalidateAppointment(
        id,
        existingAppointment.barber_id,
        existingAppointment.scheduled_at.split('T')[0]
      );

      return updatedAppointment;
      
    } catch (error) {
      Logger.error('Error updating appointment status', { appointmentId: id, status, error });
      throw error;
    }
  }

  // =====================================================
  // AÇÕES ESPECÍFICAS
  // =====================================================

  async cancelAppointment(id, userId = null, userRole = null) {
    return await this.updateAppointmentStatus(id, 'cancelled', userId, userRole);
  }

  async confirmAppointment(id, userId = null, userRole = null) {
    return await this.updateAppointmentStatus(id, 'confirmed', userId, userRole);
  }

  async completeAppointment(id, userId = null, userRole = null) {
    return await this.updateAppointmentStatus(id, 'completed', userId, userRole);
  }

  // =====================================================
  // CONSULTAS ESPECIAIS
  // =====================================================

  async getUpcomingAppointments(barberId = null, limit = 20) {
    try {
      const cacheKey = `upcoming_appointments:${barberId || 'all'}:${limit}`;
      
      return await cache.wrap(cacheKey, async () => {
        return await this.appointmentRepository.findUpcoming(barberId, limit);
      }, 60000); // Cache por 1 minuto
      
    } catch (error) {
      Logger.error('Error getting upcoming appointments', { barberId, error });
      throw error;
    }
  }

  async getAppointmentStatistics(options = {}) {
    try {
      const cacheKey = `stats:appointments:${JSON.stringify(options)}`;
      
      return await cache.wrap(cacheKey, async () => {
        return await this.appointmentRepository.getStatistics(options);
      }, cache.ttls.statistics);
      
    } catch (error) {
      Logger.error('Error getting appointment statistics', { options, error });
      throw error;
    }
  }

  // =====================================================
  // HORÁRIOS DISPONÍVEIS
  // =====================================================

  async getAvailableSlots(barberId, date, serviceId = null) {
    try {
      return await this.schedulingService.generateAvailableSlots(barberId, date, serviceId);
    } catch (error) {
      Logger.error('Error getting available slots', { barberId, date, serviceId, error });
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS DE VALIDAÇÃO PRIVADOS
  // =====================================================

  async validateCreatePermissions(appointmentData, userId, userRole) {
    const { client_id, barber_id } = appointmentData;

    // Admin pode criar qualquer agendamento
    if (userRole === 'admin') return;

    // Cliente só pode criar agendamento para si mesmo
    if (userRole === 'client' && userId !== client_id) {
      throw AppError.forbidden('Você só pode criar agendamentos para si mesmo');
    }

    // Barbeiro pode criar agendamentos para qualquer cliente
    if (userRole === 'barber') return;

    throw AppError.forbidden('Permissão insuficiente para criar agendamentos');
  }

  async validateViewPermissions(appointment, userId, userRole) {
    // Admin pode ver qualquer agendamento
    if (userRole === 'admin') return;

    // Cliente pode ver seus próprios agendamentos
    if (userRole === 'client' && userId === appointment.client_id) return;

    // Barbeiro pode ver agendamentos onde é o responsável
    if (userRole === 'barber' && userId === appointment.barber_id) return;

    throw AppError.forbidden('Você não tem permissão para ver este agendamento');
  }

  async validateUpdatePermissions(appointment, updateData, userId, userRole) {
    // Admin pode atualizar qualquer coisa
    if (userRole === 'admin') return;

    // Cliente pode cancelar seus próprios agendamentos ou alterar observações
    if (userRole === 'client' && userId === appointment.client_id) {
      const allowedFields = ['notes', 'status'];
      const updateFields = Object.keys(updateData);
      
      // Só pode alterar status para 'cancelled'
      if (updateData.status && updateData.status !== 'cancelled') {
        throw AppError.forbidden('Cliente só pode cancelar agendamentos');
      }

      const hasInvalidField = updateFields.some(field => !allowedFields.includes(field));
      if (hasInvalidField) {
        throw AppError.forbidden('Cliente só pode alterar observações ou cancelar');
      }
      
      return;
    }

    // Barbeiro pode atualizar agendamentos onde é responsável
    if (userRole === 'barber' && userId === appointment.barber_id) {
      // Barbeiro não pode alterar cliente, barbeiro ou preço
      const forbiddenFields = ['client_id', 'barber_id', 'price'];
      const updateFields = Object.keys(updateData);
      
      const hasForbiddenField = updateFields.some(field => forbiddenFields.includes(field));
      if (hasForbiddenField) {
        throw AppError.forbidden('Barbeiro não pode alterar cliente, barbeiro ou preço');
      }
      
      return;
    }

    throw AppError.forbidden('Você não tem permissão para atualizar este agendamento');
  }

  async validateStatusChangePermissions(appointment, status, userId, userRole) {
    // Admin pode alterar qualquer status
    if (userRole === 'admin') return;

    // Cliente só pode cancelar
    if (userRole === 'client' && userId === appointment.client_id) {
      if (status !== 'cancelled') {
        throw AppError.forbidden('Cliente só pode cancelar agendamentos');
      }
      return;
    }

    // Barbeiro pode confirmar e completar seus agendamentos
    if (userRole === 'barber' && userId === appointment.barber_id) {
      const allowedStatuses = ['confirmed', 'completed', 'no_show'];
      if (!allowedStatuses.includes(status)) {
        throw AppError.forbidden('Status não permitido para barbeiro');
      }
      return;
    }

    throw AppError.forbidden('Você não tem permissão para alterar este status');
  }

  async validateBusinessRules(appointmentData) {
    const { client_id, barber_id, service_id, scheduled_at } = appointmentData;

    // Verifica se a data não é no passado
    const appointmentDate = new Date(scheduled_at);
    const now = new Date();
    
    if (appointmentDate <= now) {
      throw AppError.badRequest('Não é possível agendar para datas passadas');
    }

    // Verifica se é em horário comercial
    const dayOfWeek = appointmentDate.getDay();
    if (dayOfWeek === 0) { // Domingo
      throw AppError.badRequest('Não atendemos aos domingos');
    }

    const hour = appointmentDate.getHours();
    if (hour < 8 || hour >= 18) {
      throw AppError.badRequest('Horário fora do funcionamento (8h às 18h)');
    }

    // Verifica se cliente e barbeiro são diferentes
    if (client_id === barber_id) {
      throw AppError.badRequest('Cliente e barbeiro não podem ser a mesma pessoa');
    }

    // Verifica se cliente existe e está ativo
    const client = await this.userRepository.findById(client_id);
    if (!client || client.role !== 'client' || !client.is_active) {
      throw AppError.badRequest('Cliente inválido ou inativo');
    }

    // Verifica se barbeiro existe e está ativo
    const barber = await this.userRepository.findById(barber_id);
    if (!barber || barber.role !== 'barber' || !barber.is_active) {
      throw AppError.badRequest('Barbeiro inválido ou inativo');
    }
  }
}

module.exports = { AppointmentService };