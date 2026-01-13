import { ApiResponse, PaginatedResponse } from '../models';

export class ResponseService {
  /**
   * Resposta de sucesso simples
   */
  static success<T>(
    message: string,
    data?: T,
    statusCode: number = 200
  ): { response: ApiResponse<T>; statusCode: number } {
    return {
      response: {
        success: true,
        message,
        data,
      },
      statusCode,
    };
  }

  /**
   * Resposta de erro
   */
  static error(
    message: string,
    error?: string,
    statusCode: number = 400
  ): { response: ApiResponse; statusCode: number } {
    return {
      response: {
        success: false,
        message,
        error,
      },
      statusCode,
    };
  }

  /**
   * Resposta paginada
   */
  static paginated<T>(
    message: string,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    statusCode: number = 200
  ): { response: PaginatedResponse<T>; statusCode: number } {
    return {
      response: {
        success: true,
        message,
        data,
        pagination: {
          ...pagination,
          total_pages: Math.ceil(pagination.total / pagination.limit),
        },
      },
      statusCode,
    };
  }

  /**
   * Resposta de criação bem-sucedida
   */
  static created<T>(message: string, data: T): { response: ApiResponse<T>; statusCode: number } {
    return this.success(message, data, 201);
  }

  /**
   * Resposta de não encontrado
   */
  static notFound(message: string = 'Recurso não encontrado'): { response: ApiResponse; statusCode: number } {
    return this.error(message, undefined, 404);
  }

  /**
   * Resposta de não autorizado
   */
  static unauthorized(message: string = 'Não autorizado'): { response: ApiResponse; statusCode: number } {
    return this.error(message, undefined, 401);
  }

  /**
   * Resposta de proibido
   */
  static forbidden(message: string = 'Acesso negado'): { response: ApiResponse; statusCode: number } {
    return this.error(message, undefined, 403);
  }

  /**
   * Resposta de conflito
   */
  static conflict(message: string): { response: ApiResponse; statusCode: number } {
    return this.error(message, undefined, 409);
  }

  /**
   * Resposta de validação inválida
   */
  static validationError(message: string, errors?: any): { response: ApiResponse; statusCode: number } {
    return this.error(message, typeof errors === 'string' ? errors : JSON.stringify(errors), 422);
  }

  /**
   * Resposta de erro interno do servidor
   */
  static internalError(
    message: string = 'Erro interno do servidor',
    error?: string
  ): { response: ApiResponse; statusCode: number } {
    return this.error(message, error, 500);
  }
}

export class ErrorMessages {
  // User messages
  static readonly USER_NOT_FOUND = 'Usuário não encontrado';
  static readonly USER_EMAIL_EXISTS = 'Email já está em uso';
  static readonly USER_PHONE_EXISTS = 'Telefone já está em uso';
  static readonly USER_CREATED = 'Usuário criado com sucesso';
  static readonly USER_UPDATED = 'Usuário atualizado com sucesso';
  static readonly USER_DELETED = 'Usuário removido com sucesso';

  // Auth messages
  static readonly INVALID_CREDENTIALS = 'Email ou senha inválidos';
  static readonly LOGIN_SUCCESS = 'Login realizado com sucesso';
  static readonly LOGOUT_SUCCESS = 'Logout realizado com sucesso';
  static readonly TOKEN_REQUIRED = 'Token de acesso requerido';
  static readonly TOKEN_INVALID = 'Token inválido';
  static readonly TOKEN_EXPIRED = 'Token expirado';
  static readonly REFRESH_TOKEN_REQUIRED = 'Refresh token requerido';
  static readonly REFRESH_TOKEN_INVALID = 'Refresh token inválido';
  static readonly PASSWORD_CHANGED = 'Senha alterada com sucesso';
  static readonly CURRENT_PASSWORD_INVALID = 'Senha atual inválida';

  // Role messages
  static readonly INSUFFICIENT_PERMISSIONS = 'Permissões insuficientes';
  static readonly ADMIN_REQUIRED = 'Acesso restrito a administradores';
  static readonly BARBER_OR_ADMIN_REQUIRED = 'Acesso restrito a barbeiros ou administradores';

  // Barber messages
  static readonly BARBER_NOT_FOUND = 'Barbeiro não encontrado';
  static readonly BARBER_CREATED = 'Barbeiro criado com sucesso';
  static readonly BARBER_UPDATED = 'Barbeiro atualizado com sucesso';
  static readonly BARBER_DELETED = 'Barbeiro removido com sucesso';
  static readonly BARBER_USER_EXISTS = 'Usuário já é um barbeiro';

  // Service messages
  static readonly SERVICE_NOT_FOUND = 'Serviço não encontrado';
  static readonly SERVICE_NAME_EXISTS = 'Nome do serviço já está em uso';
  static readonly SERVICE_CREATED = 'Serviço criado com sucesso';
  static readonly SERVICE_UPDATED = 'Serviço atualizado com sucesso';
  static readonly SERVICE_DELETED = 'Serviço removido com sucesso';

  // Business Hours messages
  static readonly BUSINESS_HOURS_NOT_FOUND = 'Horário de funcionamento não encontrado';
  static readonly BUSINESS_HOURS_EXISTS = 'Horário para este dia já existe';
  static readonly BUSINESS_HOURS_CREATED = 'Horário de funcionamento criado com sucesso';
  static readonly BUSINESS_HOURS_UPDATED = 'Horário de funcionamento atualizado com sucesso';
  static readonly BUSINESS_HOURS_DELETED = 'Horário de funcionamento removido com sucesso';

  // Appointment messages
  static readonly APPOINTMENT_NOT_FOUND = 'Agendamento não encontrado';
  static readonly APPOINTMENT_CONFLICT = 'Conflito de horário detectado';
  static readonly APPOINTMENT_CREATED = 'Agendamento criado com sucesso';
  static readonly APPOINTMENT_UPDATED = 'Agendamento atualizado com sucesso';
  static readonly APPOINTMENT_CANCELLED = 'Agendamento cancelado com sucesso';
  static readonly APPOINTMENT_INVALID_TIME = 'Horário inválido para agendamento';
  static readonly APPOINTMENT_PAST_DATE = 'Não é possível agendar para datas passadas';
  static readonly APPOINTMENT_OUTSIDE_HOURS = 'Horário fora do funcionamento';
  static readonly APPOINTMENT_BARBER_UNAVAILABLE = 'Barbeiro indisponível no horário solicitado';

  // General messages
  static readonly VALIDATION_ERROR = 'Dados inválidos';
  static readonly INTERNAL_ERROR = 'Erro interno do servidor';
  static readonly NOT_FOUND = 'Recurso não encontrado';
  static readonly SUCCESS = 'Operação realizada com sucesso';
  static readonly ACCESS_DENIED = 'Acesso negado';
}