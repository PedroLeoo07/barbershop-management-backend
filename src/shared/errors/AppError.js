// =====================================================
// CLASSE DE ERROS CUSTOMIZADA PROFISSIONAL
// =====================================================

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
    
    // Captura stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  // =====================================================
  // 🔥 FACTORY METHODS PARA ERROS COMUNS
  // =====================================================

  static badRequest(message, errorCode = 'BAD_REQUEST') {
    return new AppError(message, 400, errorCode);
  }

  static unauthorized(message = 'Não autorizado', errorCode = 'UNAUTHORIZED') {
    return new AppError(message, 401, errorCode);
  }

  static forbidden(message = 'Acesso negado', errorCode = 'FORBIDDEN') {
    return new AppError(message, 403, errorCode);
  }

  static notFound(message = 'Recurso não encontrado', errorCode = 'NOT_FOUND') {
    return new AppError(message, 404, errorCode);
  }

  static conflict(message, errorCode = 'CONFLICT') {
    return new AppError(message, 409, errorCode);
  }

  static unprocessableEntity(message, errorCode = 'UNPROCESSABLE_ENTITY') {
    return new AppError(message, 422, errorCode);
  }

  static tooManyRequests(message = 'Muitas tentativas', errorCode = 'TOO_MANY_REQUESTS') {
    return new AppError(message, 429, errorCode);
  }

  static internalServer(message = 'Erro interno do servidor', errorCode = 'INTERNAL_SERVER_ERROR') {
    return new AppError(message, 500, errorCode);
  }

  // =====================================================
  // 🎯 ERROS ESPECÍFICOS DO DOMÍNIO
  // =====================================================

  static invalidCredentials(message = 'Credenciais inválidas') {
    return new AppError(message, 401, 'INVALID_CREDENTIALS');
  }

  static tokenExpired(message = 'Token expirado') {
    return new AppError(message, 401, 'TOKEN_EXPIRED');
  }

  static appointmentConflict(message = 'Conflito de agendamento') {
    return new AppError(message, 409, 'APPOINTMENT_CONFLICT');
  }

  static scheduleNotAvailable(message = 'Horário não disponível') {
    return new AppError(message, 409, 'SCHEDULE_NOT_AVAILABLE');
  }

  static invalidTimeSlot(message = 'Horário inválido') {
    return new AppError(message, 400, 'INVALID_TIME_SLOT');
  }

  static userNotFound(message = 'Usuário não encontrado') {
    return new AppError(message, 404, 'USER_NOT_FOUND');
  }

  static barberNotFound(message = 'Barbeiro não encontrado') {
    return new AppError(message, 404, 'BARBER_NOT_FOUND');
  }

  static serviceNotFound(message = 'Serviço não encontrado') {
    return new AppError(message, 404, 'SERVICE_NOT_FOUND');
  }

  static appointmentNotFound(message = 'Agendamento não encontrado') {
    return new AppError(message, 404, 'APPOINTMENT_NOT_FOUND');
  }

  static invalidStatusTransition(currentStatus, newStatus) {
    return new AppError(
      `Transição de status inválida: ${currentStatus} → ${newStatus}`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  static pastAppointment(message = 'Não é possível agendar no passado') {
    return new AppError(message, 400, 'PAST_APPOINTMENT');
  }

  static appointmentTooFar(message = 'Agendamento muito distante') {
    return new AppError(message, 400, 'APPOINTMENT_TOO_FAR');
  }

  static outsideBusinessHours(message = 'Fora do horário de funcionamento') {
    return new AppError(message, 400, 'OUTSIDE_BUSINESS_HOURS');
  }

  static closedDay(message = 'Dia não disponível para agendamentos') {
    return new AppError(message, 400, 'CLOSED_DAY');
  }

  // =====================================================
  // 📊 ERROS DE VALIDAÇÃO
  // =====================================================

  static validationError(message, details = null) {
    const error = new AppError(message, 422, 'VALIDATION_ERROR');
    if (details) {
      error.validationDetails = details;
    }
    return error;
  }

  static requiredField(fieldName) {
    return new AppError(
      `Campo obrigatório: ${fieldName}`,
      400,
      'REQUIRED_FIELD'
    );
  }

  static invalidFormat(fieldName, expectedFormat) {
    return new AppError(
      `Formato inválido para ${fieldName}. Esperado: ${expectedFormat}`,
      400,
      'INVALID_FORMAT'
    );
  }

  static duplicateEntry(fieldName, value) {
    return new AppError(
      `${fieldName} '${value}' já está em uso`,
      409,
      'DUPLICATE_ENTRY'
    );
  }

  // =====================================================
  // 🔒 ERROS DE SEGURANÇA
  // =====================================================

  static rateLimitExceeded(retryAfter = null) {
    const error = new AppError(
      'Limite de requisições excedido',
      429,
      'RATE_LIMIT_EXCEEDED'
    );
    if (retryAfter) {
      error.retryAfter = retryAfter;
    }
    return error;
  }

  static suspiciousActivity(message = 'Atividade suspeita detectada') {
    return new AppError(message, 403, 'SUSPICIOUS_ACTIVITY');
  }

  static accountLocked(message = 'Conta temporariamente bloqueada') {
    return new AppError(message, 403, 'ACCOUNT_LOCKED');
  }

  // =====================================================
  // 💾 ERROS DE BANCO DE DADOS
  // =====================================================

  static databaseError(message = 'Erro de banco de dados', originalError = null) {
    const error = new AppError(message, 500, 'DATABASE_ERROR');
    if (originalError) {
      error.originalError = originalError.message;
    }
    return error;
  }

  static connectionError(message = 'Erro de conexão com banco') {
    return new AppError(message, 500, 'DATABASE_CONNECTION_ERROR');
  }

  static transactionError(message = 'Erro na transação') {
    return new AppError(message, 500, 'TRANSACTION_ERROR');
  }

  // =====================================================
  // 🌐 ERROS DE INTEGRAÇÃO
  // =====================================================

  static externalServiceError(serviceName, message = 'Serviço indisponível') {
    return new AppError(
      `${serviceName}: ${message}`,
      503,
      'EXTERNAL_SERVICE_ERROR'
    );
  }

  static timeoutError(message = 'Tempo limite excedido') {
    return new AppError(message, 504, 'TIMEOUT_ERROR');
  }

  // =====================================================
  // 🛠️ MÉTODOS DE UTILIDADE
  // =====================================================

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
      ...(this.validationDetails && { validationDetails: this.validationDetails }),
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
      ...(this.originalError && { originalError: this.originalError })
    };
  }

  toString() {
    return `${this.name}: ${this.message} (${this.statusCode})`;
  }

  // =====================================================
  // 🔍 MÉTODOS DE VERIFICAÇÃO
  // =====================================================

  isClientError() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  isServerError() {
    return this.statusCode >= 500;
  }

  isValidationError() {
    return this.errorCode === 'VALIDATION_ERROR';
  }

  isAuthError() {
    return ['UNAUTHORIZED', 'FORBIDDEN', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED'].includes(this.errorCode);
  }

  isConflictError() {
    return ['CONFLICT', 'APPOINTMENT_CONFLICT', 'DUPLICATE_ENTRY'].includes(this.errorCode);
  }

  // =====================================================
  // 📝 LOG FORMATTING
  // =====================================================

  getLogInfo() {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  // =====================================================
  // 🎨 FORMATAÇÃO PARA RESPOSTA HTTP
  // =====================================================

  getHttpResponse() {
    const response = {
      success: false,
      error: this.errorCode || this.name,
      message: this.message,
      timestamp: this.timestamp
    };

    // Adiciona detalhes específicos se existirem
    if (this.validationDetails) {
      response.validationErrors = this.validationDetails;
    }

    if (this.retryAfter) {
      response.retryAfter = this.retryAfter;
    }

    // Em desenvolvimento, adiciona stack trace
    if (process.env.NODE_ENV === 'development') {
      response.stack = this.stack;
    }

    return response;
  }
}

module.exports = { AppError };