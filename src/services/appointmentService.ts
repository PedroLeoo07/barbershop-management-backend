import { AppointmentRepository } from '../repositories/appointmentRepository';
import { UserRepository } from '../repositories/userRepository';
import { ServiceRepository } from '../repositories/serviceRepository';
import { DateTimeService } from '../utils/datetime';
import { ErrorMessages } from '../utils/responses';
import { 
  Appointment, 
  CreateAppointmentData, 
  UpdateAppointmentData,
  AppointmentStatus,
  AvailableSlot,
  AppointmentFiltersInput,
  PaginationInput
} from '../models';

export class AppointmentService {
  /**
   * Criar novo agendamento
   */
  static async createAppointment(appointmentData: CreateAppointmentData): Promise<Appointment> {
    // Validar se cliente existe
    const client = await UserRepository.findById(appointmentData.client_id);
    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    // Validar se barbeiro existe (será implementado quando criarmos BarberRepository)
    // const barber = await BarberRepository.findById(appointmentData.barber_id);
    // if (!barber || !barber.is_available) {
    //   throw new Error('Barbeiro não encontrado ou indisponível');
    // }

    // Validar se serviço existe
    const service = await ServiceRepository.findById(appointmentData.service_id);
    if (!service || !service.is_active) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    // Validar data e horário
    const isValidDateTime = DateTimeService.isDateTimeInFuture(
      appointmentData.appointment_date,
      appointmentData.start_time
    );

    if (!isValidDateTime) {
      throw new Error(ErrorMessages.APPOINTMENT_PAST_DATE);
    }

    // Calcular horário de fim baseado na duração do serviço
    const endTime = DateTimeService.addMinutesToTime(
      appointmentData.start_time,
      service.duration_minutes
    );

    // Verificar conflitos de horário
    const hasConflict = await AppointmentRepository.checkTimeConflict({
      barber_id: appointmentData.barber_id,
      appointment_date: appointmentData.appointment_date,
      start_time: appointmentData.start_time,
      end_time: endTime,
    });

    if (hasConflict) {
      throw new Error(ErrorMessages.APPOINTMENT_CONFLICT);
    }

    // Verificar se está dentro do horário de funcionamento
    // Esta validação será implementada quando tivermos as tabelas de horários

    // Criar agendamento
    const appointment = await AppointmentRepository.create({
      ...appointmentData,
      end_time: endTime,
      total_price: service.price,
    });

    // Buscar agendamento completo com relacionamentos
    const fullAppointment = await AppointmentRepository.findById(appointment.id);
    if (!fullAppointment) {
      throw new Error('Erro ao criar agendamento');
    }

    return fullAppointment;
  }

  /**
   * Buscar agendamento por ID
   */
  static async getAppointmentById(id: string): Promise<Appointment> {
    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    return appointment;
  }

  /**
   * Atualizar agendamento
   */
  static async updateAppointment(
    id: string,
    updateData: UpdateAppointmentData,
    currentUserId: string,
    userRole: string
  ): Promise<Appointment> {
    // Buscar agendamento atual
    const currentAppointment = await AppointmentRepository.findById(id);
    if (!currentAppointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Verificar permissões
    const isOwner = currentAppointment.client_id === currentUserId;
    const isBarber = currentAppointment.barber?.user?.id === currentUserId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isBarber && !isAdmin) {
      throw new Error(ErrorMessages.ACCESS_DENIED);
    }

    // Se está alterando data/horário, validar novamente
    if (updateData.appointment_date || updateData.start_time) {
      const newDate = updateData.appointment_date || DateTimeService.formatDate(currentAppointment.appointment_date);
      const newStartTime = updateData.start_time || currentAppointment.start_time;

      // Validar se não é no passado
      if (!DateTimeService.isDateTimeInFuture(newDate, newStartTime)) {
        throw new Error(ErrorMessages.APPOINTMENT_PAST_DATE);
      }

      // Calcular novo horário de fim se necessário
      let newEndTime = currentAppointment.end_time;
      if (updateData.start_time && currentAppointment.service) {
        newEndTime = DateTimeService.addMinutesToTime(
          newStartTime,
          currentAppointment.service.duration_minutes
        );
      }

      // Verificar conflitos (excluindo o agendamento atual)
      const hasConflict = await AppointmentRepository.checkTimeConflict({
        barber_id: currentAppointment.barber_id,
        appointment_date: newDate,
        start_time: newStartTime,
        end_time: newEndTime,
        exclude_id: id,
      });

      if (hasConflict) {
        throw new Error(ErrorMessages.APPOINTMENT_CONFLICT);
      }

      // Adicionar end_time aos dados de atualização se necessário
      if (updateData.start_time) {
        (updateData as any).end_time = newEndTime;
      }
    }

    // Atualizar agendamento
    const updatedAppointment = await AppointmentRepository.update(id, updateData);
    if (!updatedAppointment) {
      throw new Error('Erro ao atualizar agendamento');
    }

    // Buscar agendamento completo
    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento atualizado');
    }

    return fullAppointment;
  }

  /**
   * Cancelar agendamento
   */
  static async cancelAppointment(
    id: string,
    currentUserId: string,
    userRole: string
  ): Promise<Appointment> {
    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Verificar permissões
    const isOwner = appointment.client_id === currentUserId;
    const isBarber = appointment.barber?.user?.id === currentUserId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isBarber && !isAdmin) {
      throw new Error(ErrorMessages.ACCESS_DENIED);
    }

    // Verificar se pode ser cancelado (não pode cancelar agendamentos já concluídos)
    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new Error('Não é possível cancelar agendamento já concluído');
    }

    // Atualizar status para cancelado
    const updatedAppointment = await AppointmentRepository.update(id, {
      status: AppointmentStatus.CANCELLED,
    });

    if (!updatedAppointment) {
      throw new Error('Erro ao cancelar agendamento');
    }

    // Buscar agendamento completo
    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento cancelado');
    }

    return fullAppointment;
  }

  /**
   * Listar agendamentos com filtros
   */
  static async getAppointments(
    filters: AppointmentFiltersInput,
    pagination: PaginationInput,
    currentUserId?: string,
    userRole?: string
  ): Promise<{ appointments: Appointment[]; total: number }> {
    const queryFilters: any = { ...filters };

    // Se não for admin, filtrar por usuário
    if (userRole !== 'ADMIN') {
      if (userRole === 'CLIENT') {
        queryFilters.client_id = currentUserId;
      } else if (userRole === 'BARBER') {
        // Buscar ID do barbeiro baseado no user_id
        // queryFilters.barber_id = await BarberRepository.findByUserId(currentUserId);
      }
    }

    return await AppointmentRepository.findAll({
      ...queryFilters,
      page: pagination.page,
      limit: pagination.limit,
    });
  }

  /**
   * Buscar slots disponíveis para agendamento
   */
  static async getAvailableSlots(params: {
    date: string;
    service_id: string;
    barber_id?: string;
  }): Promise<AvailableSlot[]> {
    // Validar se serviço existe
    const service = await ServiceRepository.findById(params.service_id);
    if (!service || !service.is_active) {
      throw new Error('Serviço não encontrado ou inativo');
    }

    // Validar se a data não é no passado
    const requestDate = new Date(params.date);
    if (!DateTimeService.isFuture(requestDate) && !DateTimeService.isToday(requestDate)) {
      throw new Error('Não é possível buscar horários para datas passadas');
    }

    return await AppointmentRepository.findAvailableSlots(params);
  }

  /**
   * Buscar agendamentos de hoje
   */
  static async getTodayAppointments(): Promise<Appointment[]> {
    return await AppointmentRepository.findTodayAppointments();
  }

  /**
   * Confirmar agendamento (barbeiro/admin)
   */
  static async confirmAppointment(
    id: string,
    userRole: string
  ): Promise<Appointment> {
    // Verificar permissão
    if (userRole !== 'BARBER' && userRole !== 'ADMIN') {
      throw new Error(ErrorMessages.BARBER_OR_ADMIN_REQUIRED);
    }

    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Só pode confirmar se estiver agendado
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new Error('Só é possível confirmar agendamentos com status "SCHEDULED"');
    }

    const updatedAppointment = await AppointmentRepository.update(id, {
      status: AppointmentStatus.CONFIRMED,
    });

    if (!updatedAppointment) {
      throw new Error('Erro ao confirmar agendamento');
    }

    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento confirmado');
    }

    return fullAppointment;
  }

  /**
   * Iniciar atendimento (barbeiro)
   */
  static async startAppointment(
    id: string,
    userRole: string
  ): Promise<Appointment> {
    if (userRole !== 'BARBER' && userRole !== 'ADMIN') {
      throw new Error(ErrorMessages.BARBER_OR_ADMIN_REQUIRED);
    }

    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Verificar se está confirmado ou agendado
    if (![AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED].includes(appointment.status)) {
      throw new Error('Agendamento deve estar confirmado ou agendado para iniciar');
    }

    const updatedAppointment = await AppointmentRepository.update(id, {
      status: AppointmentStatus.IN_PROGRESS,
    });

    if (!updatedAppointment) {
      throw new Error('Erro ao iniciar atendimento');
    }

    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento em progresso');
    }

    return fullAppointment;
  }

  /**
   * Finalizar atendimento (barbeiro)
   */
  static async completeAppointment(
    id: string,
    userRole: string
  ): Promise<Appointment> {
    if (userRole !== 'BARBER' && userRole !== 'ADMIN') {
      throw new Error(ErrorMessages.BARBER_OR_ADMIN_REQUIRED);
    }

    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Verificar se está em progresso
    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new Error('Agendamento deve estar em progresso para ser finalizado');
    }

    const updatedAppointment = await AppointmentRepository.update(id, {
      status: AppointmentStatus.COMPLETED,
    });

    if (!updatedAppointment) {
      throw new Error('Erro ao finalizar atendimento');
    }

    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento concluído');
    }

    return fullAppointment;
  }

  /**
   * Marcar cliente como não compareceu (barbeiro/admin)
   */
  static async markAsNoShow(
    id: string,
    userRole: string
  ): Promise<Appointment> {
    if (userRole !== 'BARBER' && userRole !== 'ADMIN') {
      throw new Error(ErrorMessages.BARBER_OR_ADMIN_REQUIRED);
    }

    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    const updatedAppointment = await AppointmentRepository.update(id, {
      status: AppointmentStatus.NO_SHOW,
    });

    if (!updatedAppointment) {
      throw new Error('Erro ao marcar como não compareceu');
    }

    const fullAppointment = await AppointmentRepository.findById(id);
    if (!fullAppointment) {
      throw new Error('Erro ao buscar agendamento marcado como não compareceu');
    }

    return fullAppointment;
  }

  /**
   * Buscar estatísticas de agendamentos
   */
  static async getAppointmentStatistics(params: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    revenue: number;
    today_appointments: number;
    completion_rate: number;
    cancellation_rate: number;
  }> {
    const stats = await AppointmentRepository.getAppointmentStats(params);

    // Calcular percentuais
    const completion_rate = stats.total_appointments > 0 
      ? (stats.completed_appointments / stats.total_appointments) * 100 
      : 0;

    const cancellation_rate = stats.total_appointments > 0
      ? (stats.cancelled_appointments / stats.total_appointments) * 100
      : 0;

    return {
      ...stats,
      completion_rate: Math.round(completion_rate * 100) / 100,
      cancellation_rate: Math.round(cancellation_rate * 100) / 100,
    };
  }

  /**
   * Reagendar agendamento
   */
  static async rescheduleAppointment(
    id: string,
    newDate: string,
    newStartTime: string,
    currentUserId: string,
    userRole: string
  ): Promise<Appointment> {
    const appointment = await AppointmentRepository.findById(id);
    if (!appointment) {
      throw new Error(ErrorMessages.APPOINTMENT_NOT_FOUND);
    }

    // Verificar permissões
    const isOwner = appointment.client_id === currentUserId;
    const isAdmin = userRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      throw new Error(ErrorMessages.ACCESS_DENIED);
    }

    // Verificar se pode ser reagendado
    if ([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED].includes(appointment.status)) {
      throw new Error('Não é possível reagendar agendamento concluído ou cancelado');
    }

    // Atualizar com nova data e horário
    return await this.updateAppointment(
      id,
      {
        appointment_date: newDate,
        start_time: newStartTime,
        status: AppointmentStatus.SCHEDULED, // Resetar para agendado
      },
      currentUserId,
      userRole
    );
  }
}