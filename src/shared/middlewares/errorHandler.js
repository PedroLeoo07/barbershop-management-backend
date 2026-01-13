const { AppError } = require('../errors/AppError');

// =====================================================
// MIDDLEWARE DE TRATAMENTO DE ERROS PROFISSIONAL
// =====================================================

class ErrorHandler {
  // =====================================================
  // 🎯 HANDLER PRINCIPAL DE ERROS
  // =====================================================

  static handleError(error, req, res, next) {
    // Log do erro sempre
    ErrorHandler.logError(error, req);

    // Se já enviamos uma resposta, não fazer nada
    if (res.headersSent) {
      return next(error);
    }

    let errorToSend;

    // Se é um erro operacional nosso
    if (error instanceof AppError) {
      errorToSend = error;
    }
    // Se é erro de validação do Joi/Zod
    else if (error.name === 'ValidationError' || error.name === 'ZodError') {
      errorToSend = ErrorHandler.handleValidationError(error);
    }
    // Erro de JWT
    else if (error.name === 'JsonWebTokenError') {
      errorToSend = AppError.unauthorized('Token inválido');
    }
    else if (error.name === 'TokenExpiredError') {
      errorToSend = AppError.tokenExpired('Token expirado');
    }
    // Erros de banco PostgreSQL
    else if (error.code) {
      errorToSend = ErrorHandler.handleDatabaseError(error);
    }
    // Erros de rate limit
    else if (error.type === 'entity.too.large') {
      errorToSend = AppError.badRequest('Arquivo muito grande');
    }
    // Erro genérico
    else {
      errorToSend = AppError.internalServer(
        process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Erro interno do servidor'
      );
    }

    // Enviar resposta
    res.status(errorToSend.statusCode).json(errorToSend.getHttpResponse());
  }

  // =====================================================
  // 🔍 HANDLER PARA ERROS NÃO CAPTURADOS
  // =====================================================

  static handleUncaughtException(error) {
    console.error('💀 UNCAUGHT EXCEPTION:', error);
    console.error(error.stack);
    
    // Graceful shutdown
    process.exit(1);
  }

  static handleUnhandledRejection(reason, promise) {
    console.error('💀 UNHANDLED REJECTION at:', promise);
    console.error('Reason:', reason);
    
    // Graceful shutdown
    process.exit(1);
  }

  // =====================================================
  // 📊 HANDLERS ESPECÍFICOS POR TIPO DE ERRO
  // =====================================================

  static handleValidationError(error) {
    let message = 'Dados inválidos';
    let details = null;

    // Zod validation errors
    if (error.name === 'ZodError') {
      details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      message = 'Dados de entrada inválidos';
    }
    // Joi validation errors
    else if (error.details) {
      details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        code: detail.type
      }));
    }

    const validationError = AppError.validationError(message, details);
    return validationError;
  }

  static handleDatabaseError(error) {
    console.error('🔥 Database Error:', error.code, error.message);

    switch (error.code) {
      case '23505': // unique_violation
        const field = ErrorHandler.extractFieldFromPgError(error);
        return AppError.duplicateEntry(field, 'valor informado');
        
      case '23503': // foreign_key_violation
        return AppError.badRequest('Referência inválida a recurso relacionado');
        
      case '23502': // not_null_violation
        const nullField = ErrorHandler.extractFieldFromPgError(error);
        return AppError.requiredField(nullField);
        
      case '23514': // check_violation
        return AppError.badRequest('Dados violam regras de negócio');
        
      case '42P01': // undefined_table
        return AppError.internalServer('Erro de configuração do banco');
        
      case '42703': // undefined_column
        return AppError.internalServer('Erro na estrutura da consulta');
        
      case 'ECONNREFUSED':
      case 'ENOTFOUND':
      case 'EHOSTUNREACH':
        return AppError.connectionError('Banco de dados indisponível');
        
      case '57P01': // admin_shutdown
        return AppError.connectionError('Banco em manutenção');
        
      case '53300': // too_many_connections
        return AppError.internalServer('Sistema sobrecarregado');
        
      case '40001': // serialization_failure
      case '40P01': // deadlock_detected
        return AppError.conflict('Conflito de dados, tente novamente');
        
      default:
        return AppError.databaseError(
          process.env.NODE_ENV === 'development' 
            ? `DB Error: ${error.message}`
            : 'Erro de banco de dados',
          error
        );
    }
  }

  // =====================================================
  // 🛠️ UTILITÁRIOS PARA EXTRAÇÃO DE DADOS DO ERRO
  // =====================================================

  static extractFieldFromPgError(error) {
    try {
      // Tentar extrair o campo do detail ou message
      const detail = error.detail || error.message || '';
      
      // Para unique violation: Key (email)=(test@test.com) already exists
      const uniqueMatch = detail.match(/Key \((\w+)\)/);
      if (uniqueMatch) {
        return uniqueMatch[1];
      }

      // Para not null violation: column "field_name" violates not-null constraint
      const nullMatch = detail.match(/column "(\w+)"/);
      if (nullMatch) {
        return nullMatch[1];
      }

      // Para foreign key violation: violates foreign key constraint on table "table_name"
      const fkMatch = detail.match(/on table "(\w+)"/);
      if (fkMatch) {
        return fkMatch[1];
      }

      return 'campo';
    } catch (err) {
      return 'campo';
    }
  }

  // =====================================================
  // 📝 SISTEMA DE LOGGING
  // =====================================================

  static logError(error, req = null) {
    const timestamp = new Date().toISOString();
    
    const logData = {
      timestamp,
      error: error.name,
      message: error.message,
      statusCode: error.statusCode || 500,
      errorCode: error.errorCode || 'UNKNOWN',
      ...(req && {
        request: {
          method: req.method,
          url: req.originalUrl,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          userId: req.user?.id || 'anonymous'
        }
      })
    };

    // Log baseado na severidade
    if (error.statusCode >= 500) {
      console.error('🔥 SERVER ERROR:', logData);
      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
      }
    } else if (error.statusCode >= 400) {
      console.warn('⚠️  CLIENT ERROR:', logData);
    } else {
      console.info('ℹ️  INFO:', logData);
    }

    // Em produção, aqui você enviaria para um serviço de logging
    // como Winston, Sentry, CloudWatch, etc.
    if (process.env.NODE_ENV === 'production') {
      ErrorHandler.sendToExternalLogging(logData, error);
    }
  }

  static sendToExternalLogging(logData, error) {
    // Implementar integração com serviços externos
    // Exemplos: Sentry, DataDog, New Relic, AWS CloudWatch, etc.
    
    try {
      // Sentry example:
      // Sentry.captureException(error, {
      //   extra: logData,
      //   level: error.statusCode >= 500 ? 'error' : 'warning'
      // });

      // Winston example:
      // logger.log({
      //   level: error.statusCode >= 500 ? 'error' : 'warn',
      //   message: logData.message,
      //   meta: logData
      // });

    } catch (loggingError) {
      console.error('Failed to send error to external logging:', loggingError);
    }
  }

  // =====================================================
  // 🎯 MIDDLEWARE PARA ROUTES NÃO ENCONTRADAS
  // =====================================================

  static notFoundHandler(req, res, next) {
    const error = AppError.notFound(`Rota ${req.method} ${req.originalUrl} não encontrada`);
    next(error);
  }

  // =====================================================
  // 🛡️ MIDDLEWARE DE SEGURANÇA PARA ERROS
  // =====================================================

  static securityHeaders(req, res, next) {
    // Headers de segurança
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    next();
  }

  // =====================================================
  // 🚀 CONFIGURAÇÃO DE HANDLERS GLOBAIS
  // =====================================================

  static setupGlobalHandlers() {
    // Capturar exceções não tratadas
    process.on('uncaughtException', ErrorHandler.handleUncaughtException);
    
    // Capturar promises rejeitadas
    process.on('unhandledRejection', ErrorHandler.handleUnhandledRejection);
    
    // Capturar warnings
    process.on('warning', (warning) => {
      console.warn('⚠️  Process Warning:', warning);
    });

    console.log('✅ Global error handlers configured');
  }

  // =====================================================
  // 📊 MIDDLEWARE DE HEALTH CHECK
  // =====================================================

  static healthCheck(req, res) {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV
    };

    res.status(200).json(healthData);
  }
}

module.exports = { ErrorHandler };