const rateLimit = require('express-rate-limit');
const { config } = require('../config');
const { ResponseService } = require('../utils/responses');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

/**
 * Rate limiting geral da aplicação
 */
const generalRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Muitas tentativas. Tente novamente mais tarde.',
    error: 'Rate limit excedido',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    Logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url
    });
    
    const error = AppError.badRequest('Muitas tentativas. Tente novamente mais tarde.', 'RATE_LIMIT_EXCEEDED');
    res.status(error.statusCode).json(error.toJSON());
  }
});

/**
 * Rate limiting rigoroso para login
 */
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por IP
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    error: 'Rate limit de autenticação excedido',
  },
  handler: (req, res) => {
    Logger.security('Auth rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email
    });
    
    const error = AppError.badRequest(
      'Muitas tentativas de login. Tente novamente em 15 minutos.',
      'AUTH_RATE_LIMIT_EXCEEDED'
    );
    res.status(error.statusCode).json(error.toJSON());
  }
});

/**
 * Rate limiting para criação de recursos
 */
const createResourceRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 criações por minuto
  message: {
    success: false,
    message: 'Muitas criações em pouco tempo. Aguarde um momento.',
    error: 'Rate limit de criação excedido',
  },
});

/**
 * Rate limiting para APIs administrativas
 */
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // 100 requests por minuto para admins
  message: {
    success: false,
    message: 'Rate limit administrativo excedido.',
    error: 'Muitas operações administrativas',
  },
});

/**
 * Middleware de tratamento de erros melhorado
 */
const errorHandler = (error, req, res, next) => {
  // Log do erro
  Logger.error('Unhandled error', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Se é uma instância do AppError, usar suas propriedades
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Erro de validação do Zod
  if (error.name === 'ZodError') {
    const validationError = AppError.validation('Dados de entrada inválidos');
    validationError.details = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return res.status(validationError.statusCode).json(validationError.toJSON());
  }

  // Erro de autenticação JWT
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    const authError = AppError.unauthorized('Token inválido ou expirado');
    return res.status(authError.statusCode).json(authError.toJSON());
  }

  // Erro de banco de dados PostgreSQL
  if (error.code && error.code.startsWith('23')) { // PostgreSQL constraint errors
    let dbError;
    if (error.code === '23505') { // Unique violation
      dbError = AppError.conflict('Dados duplicados encontrados');
    } else if (error.code === '23503') { // Foreign key violation
      dbError = AppError.badRequest('Referência inválida encontrada');
    } else {
      dbError = AppError.badRequest('Erro de validação no banco de dados');
    }
    return res.status(dbError.statusCode).json(dbError.toJSON());
  }

  // Erro genérico
  const internalError = AppError.internal();
  return res.status(internalError.statusCode).json({
    success: false,
    message: internalError.message,
    code: internalError.code,
    timestamp: internalError.timestamp
  });
};

/**
 * Middleware para capturar rotas não encontradas
 */
const notFoundHandler = (req, res, next) => {
  Logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  const notFoundError = AppError.notFound(`Rota ${req.method} ${req.path} não encontrada`);
  return res.status(notFoundError.statusCode).json(notFoundError.toJSON());
};

/**
 * Middleware de log de requisições melhorado
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    };

    if (res.statusCode >= 400) {
      Logger.warn('HTTP Request', logData);
    } else if (duration > 1000) {
      Logger.warn('Slow HTTP Request', logData);
    } else if (config.nodeEnv === 'development') {
      Logger.debug('HTTP Request', logData);
    }
  });
  
  next();
};

/**
 * Middleware para sanitização de entrada básica
 */
const sanitizeInput = (req, res, next) => {
  // Remover propriedades potencialmente perigosas do body
  const dangerousFields = ['__proto__', 'constructor', 'prototype'];
  
  const sanitizeObject = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const field of dangerousFields) {
        if (field in obj) {
          delete obj[field];
        }
      }
      
      // Recursivamente sanitizar objetos aninhados
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  next();
};

/**
 * Middleware para adicionar headers de segurança personalizados
 */
const securityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  createResourceRateLimit,
  adminRateLimit,
  errorHandler,
  notFoundHandler,
  requestLogger,
  sanitizeInput,
  securityHeaders,
};