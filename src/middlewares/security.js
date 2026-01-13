const rateLimit = require('express-rate-limit');
const { config } = require('../config');
const { ResponseService } = require('../utils/responses');

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
 * Middleware de tratamento de erros
 */
const errorHandler = (error, req, res, next) => {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Erro de validação do Zod
  if (error.name === 'ZodError') {
    const { response, statusCode } = ResponseService.validationError(
      'Dados de entrada inválidos'
    );
    return res.status(statusCode).json(response);
  }

  // Erro de autenticação JWT
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    const { response, statusCode } = ResponseService.unauthorized('Token inválido ou expirado');
    return res.status(statusCode).json(response);
  }

  // Erro de banco de dados PostgreSQL
  if (error.name === 'PostgresError') {
    console.error('Database error:', error);
    const { response, statusCode } = ResponseService.internalError(
      'Erro no banco de dados'
    );
    return res.status(statusCode).json(response);
  }

  // Erro genérico
  const { response, statusCode } = ResponseService.internalError();
  return res.status(statusCode).json(response);
};

/**
 * Middleware para capturar rotas não encontradas
 */
const notFoundHandler = (req, res, next) => {
  const { response, statusCode } = ResponseService.notFound(
    `Rota ${req.method} ${req.path} não encontrada`
  );
  return res.status(statusCode).json(response);
};

/**
 * Middleware de log de requisições (desenvolvimento)
 */
const requestLogger = (req, res, next) => {
  if (config.nodeEnv === 'development') {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
  }
  
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