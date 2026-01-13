// =====================================================
// CLASSE DE ERRO CUSTOMIZADA PARA O SISTEMA
// =====================================================

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    // Captura stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  // Métodos estáticos para erros comuns
  static badRequest(message, code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = 'Token inválido ou expirado', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Acesso negado', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Recurso não encontrado', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static validation(message, code = 'VALIDATION_ERROR') {
    return new AppError(message, 422, code);
  }

  static internal(message = 'Erro interno do servidor', code = 'INTERNAL_ERROR') {
    return new AppError(message, 500, code);
  }

  // Métodos específicos do domínio
  static appointmentConflict(message = 'Conflito de horário detectado') {
    return new AppError(message, 409, 'APPOINTMENT_CONFLICT');
  }

  static barberUnavailable(message = 'Barbeiro indisponível no horário solicitado') {
    return new AppError(message, 409, 'BARBER_UNAVAILABLE');
  }

  static outsideBusinessHours(message = 'Horário fora do funcionamento') {
    return new AppError(message, 400, 'OUTSIDE_BUSINESS_HOURS');
  }

  static invalidTimeSlot(message = 'Horário inválido para agendamento') {
    return new AppError(message, 400, 'INVALID_TIME_SLOT');
  }

  static pastDateBooking(message = 'Não é possível agendar para datas passadas') {
    return new AppError(message, 400, 'PAST_DATE_BOOKING');
  }

  // Converter para objeto JSON
  toJSON() {
    return {
      success: false,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
    };
  }
}

module.exports = { AppError };