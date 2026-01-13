class ResponseService {
  /**
   * Resposta de sucesso simples
   */
  static success(message, data, statusCode = 200) {
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
  static error(message, error, statusCode = 400) {
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
  static paginated(message, data, pagination, statusCode = 200) {
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
  static created(message, data) {
    return this.success(message, data, 201);
  }

  /**
   * Resposta de não encontrado
   */
  static notFound(message = 'Recurso não encontrado') {
    return this.error(message, undefined, 404);
  }

  /**
   * Resposta de não autorizado
   */
  static unauthorized(message = 'Não autorizado') {
    return this.error(message, undefined, 401);
  }

  /**
   * Resposta de proibido
   */
  static forbidden(message = 'Acesso negado') {
    return this.error(message, undefined, 403);
  }

  /**
   * Resposta de conflito
   */
  static conflict(message) {
    return this.error(message, undefined, 409);
  }

  /**
   * Resposta de validação inválida
   */
  static validationError(message, errors) {
    return this.error(message, typeof errors === 'string' ? errors : JSON.stringify(errors), 422);
  }

  /**
   * Resposta de erro interno do servidor
   */
  static internalError(message = 'Erro interno do servidor', error) {
    return this.error(message, error, 500);
  }
}

class ErrorMessages {
  // User messages
  static USER_NOT_FOUND = 'Usuário não encontrado';
  static USER_EMAIL_EXISTS = 'Email já está em uso';
  static USER_PHONE_EXISTS = 'Telefone já está em uso';
  static USER_CREATED = 'Usuário criado com sucesso';
  static USER_UPDATED = 'Usuário atualizado com sucesso';
  static USER_DELETED = 'Usuário removido com sucesso';

  // Auth messages
  static INVALID_CREDENTIALS = 'Email ou senha inválidos';
  static LOGIN_SUCCESS = 'Login realizado com sucesso';
  static LOGOUT_SUCCESS = 'Logout realizado com sucesso';
  static TOKEN_REQUIRED = 'Token de acesso requerido';
  static TOKEN_INVALID = 'Token inválido';
  static TOKEN_EXPIRED = 'Token expirado';
  static REFRESH_TOKEN_REQUIRED = 'Refresh token requerido';
  static REFRESH_TOKEN_INVALID = 'Refresh token inválido';
  static PASSWORD_CHANGED = 'Senha alterada com sucesso';
  static CURRENT_PASSWORD_INVALID = 'Senha atual inválida';

  // Role messages
  static INSUFFICIENT_PERMISSIONS = 'Permissões insuficientes';
  static ADMIN_REQUIRED = 'Acesso restrito a administradores';
  static BARBER_OR_ADMIN_REQUIRED = 'Acesso restrito a barbeiros ou administradores';

  // Barber messages
  static BARBER_NOT_FOUND = 'Barbeiro não encontrado';
  static BARBER_CREATED = 'Barbeiro criado com sucesso';
  static BARBER_UPDATED = 'Barbeiro atualizado com sucesso';
  static BARBER_DELETED = 'Barbeiro removido com sucesso';
  static BARBER_USER_EXISTS = 'Usuário já é um barbeiro';

  // Service messages
  static SERVICE_NOT_FOUND = 'Serviço não encontrado';
  static SERVICE_NAME_EXISTS = 'Nome do serviço já está em uso';
  static SERVICE_CREATED = 'Serviço criado com sucesso';
  static SERVICE_UPDATED = 'Serviço atualizado com sucesso';
  static SERVICE_DELETED = 'Serviço removido com sucesso';

  // Business Hours messages
  static BUSINESS_HOURS_NOT_FOUND = 'Horário de funcionamento não encontrado';
  static BUSINESS_HOURS_EXISTS = 'Horário para este dia já existe';
  static BUSINESS_HOURS_CREATED = 'Horário de funcionamento criado com sucesso';
  static BUSINESS_HOURS_UPDATED = 'Horário de funcionamento atualizado com sucesso';
  static BUSINESS_HOURS_DELETED = 'Horário de funcionamento removido com sucesso';

  // Appointment messages
  static APPOINTMENT_NOT_FOUND = 'Agendamento não encontrado';
  static APPOINTMENT_CONFLICT = 'Conflito de horário detectado';
  static APPOINTMENT_CREATED = 'Agendamento criado com sucesso';
  static APPOINTMENT_UPDATED = 'Agendamento atualizado com sucesso';
  static APPOINTMENT_CANCELLED = 'Agendamento cancelado com sucesso';
  static APPOINTMENT_INVALID_TIME = 'Horário inválido para agendamento';
  static APPOINTMENT_PAST_DATE = 'Não é possível agendar para datas passadas';
  static APPOINTMENT_OUTSIDE_HOURS = 'Horário fora do funcionamento';
  static APPOINTMENT_BARBER_UNAVAILABLE = 'Barbeiro indisponível no horário solicitado';

  // General messages
  static VALIDATION_ERROR = 'Dados inválidos';
  static INTERNAL_ERROR = 'Erro interno do servidor';
  static NOT_FOUND = 'Recurso não encontrado';
  static SUCCESS = 'Operação realizada com sucesso';
  static ACCESS_DENIED = 'Acesso negado';
}

module.exports = {
  ResponseService,
  ErrorMessages,
};