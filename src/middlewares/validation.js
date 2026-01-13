// =====================================================
// MIDDLEWARE DE VALIDAÇÃO CENTRALIZADA
// =====================================================

const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

/**
 * Middleware para validar body da requisição
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      Logger.warn('Body validation failed', {
        url: req.url,
        method: req.method,
        errors: error.errors,
        body: req.body
      });

      const validationError = AppError.validation('Dados de entrada inválidos');
      validationError.details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.received
      }));
      
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }
  };
};

/**
 * Middleware para validar query parameters
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData;
      next();
    } catch (error) {
      Logger.warn('Query validation failed', {
        url: req.url,
        method: req.method,
        errors: error.errors,
        query: req.query
      });

      const validationError = AppError.validation('Parâmetros de query inválidos');
      validationError.details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.received
      }));
      
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }
  };
};

/**
 * Middleware para validar parâmetros da URL
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData;
      next();
    } catch (error) {
      Logger.warn('Params validation failed', {
        url: req.url,
        method: req.method,
        errors: error.errors,
        params: req.params
      });

      const validationError = AppError.validation('Parâmetros de URL inválidos');
      validationError.details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.received
      }));
      
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }
  };
};

/**
 * Middleware para validações múltiplas
 */
const validateMultiple = (validations) => {
  return (req, res, next) => {
    try {
      const results = {};

      // Validar cada parte conforme especificado
      if (validations.body) {
        results.body = validations.body.parse(req.body);
        req.body = results.body;
      }

      if (validations.query) {
        results.query = validations.query.parse(req.query);
        req.query = results.query;
      }

      if (validations.params) {
        results.params = validations.params.parse(req.params);
        req.params = results.params;
      }

      // Adicionar dados validados ao request para fácil acesso
      req.validated = results;
      
      next();
    } catch (error) {
      Logger.warn('Multiple validation failed', {
        url: req.url,
        method: req.method,
        errors: error.errors,
        body: req.body,
        query: req.query,
        params: req.params
      });

      const validationError = AppError.validation('Dados inválidos');
      validationError.details = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        received: err.received
      }));
      
      return res.status(validationError.statusCode).json(validationError.toJSON());
    }
  };
};

/**
 * Middleware para validar se ID do parâmetro é um número válido
 */
const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || isNaN(Number(id)) || Number(id) <= 0) {
      const error = AppError.validation(`${paramName} deve ser um número válido`);
      return res.status(error.statusCode).json(error.toJSON());
    }

    req.params[paramName] = Number(id);
    next();
  };
};

/**
 * Middleware para validar paginação básica
 */
const validatePagination = () => {
  return (req, res, next) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    if (page < 1) {
      const error = AppError.validation('Página deve ser maior que 0');
      return res.status(error.statusCode).json(error.toJSON());
    }

    if (limit < 1 || limit > 100) {
      const error = AppError.validation('Limite deve ser entre 1 e 100');
      return res.status(error.statusCode).json(error.toJSON());
    }

    req.pagination = {
      page,
      limit,
      offset: (page - 1) * limit
    };

    next();
  };
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateMultiple,
  validateIdParam,
  validatePagination,
};