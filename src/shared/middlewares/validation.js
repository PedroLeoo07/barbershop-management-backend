const { z } = require('zod');
const { AppError } = require('../errors/AppError');

// =====================================================
// MIDDLEWARE DE VALIDAÇÃO PROFISSIONAL COM ZOD
// =====================================================

class ValidationMiddleware {
  // =====================================================
  // 🎯 FACTORY PRINCIPAL PARA VALIDAÇÃO
  // =====================================================

  static validate(schema, target = 'body') {
    return async (req, res, next) => {
      try {
        // Determinar qual parte da request validar
        let dataToValidate;
        
        switch (target) {
          case 'body':
            dataToValidate = req.body;
            break;
          case 'query':
            dataToValidate = req.query;
            break;
          case 'params':
            dataToValidate = req.params;
            break;
          case 'headers':
            dataToValidate = req.headers;
            break;
          default:
            dataToValidate = req.body;
        }

        // Validar com Zod
        const validatedData = await schema.parseAsync(dataToValidate);

        // Anexar dados validados na request
        req.validated = {
          ...req.validated,
          [target]: validatedData
        };

        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = ValidationMiddleware.formatZodError(error);
          return next(validationError);
        }
        
        next(AppError.internalServer('Erro na validação'));
      }
    };
  }

  // =====================================================
  // 📊 FORMATADOR DE ERROS DO ZOD
  // =====================================================

  static formatZodError(zodError) {
    const details = zodError.errors.map(error => ({
      field: error.path.join('.') || 'root',
      message: ValidationMiddleware.getPortugueseErrorMessage(error),
      value: error.received,
      code: error.code
    }));

    return AppError.validationError('Dados de entrada inválidos', details);
  }

  // =====================================================
  // 🇧🇷 TRADUÇÃO DE MENSAGENS DE ERRO
  // =====================================================

  static getPortugueseErrorMessage(error) {
    const { code, message, path } = error;
    const fieldName = path.join('.') || 'campo';

    switch (code) {
      case 'invalid_type':
        const expected = ValidationMiddleware.translateType(error.expected);
        const received = ValidationMiddleware.translateType(error.received);
        return `${fieldName} deve ser do tipo ${expected}, mas foi recebido ${received}`;
        
      case 'too_small':
        if (error.type === 'string') {
          return `${fieldName} deve ter pelo menos ${error.minimum} caracteres`;
        } else if (error.type === 'number') {
          return `${fieldName} deve ser maior ou igual a ${error.minimum}`;
        } else if (error.type === 'array') {
          return `${fieldName} deve ter pelo menos ${error.minimum} itens`;
        }
        return `${fieldName} é muito pequeno`;
        
      case 'too_big':
        if (error.type === 'string') {
          return `${fieldName} deve ter no máximo ${error.maximum} caracteres`;
        } else if (error.type === 'number') {
          return `${fieldName} deve ser menor ou igual a ${error.maximum}`;
        } else if (error.type === 'array') {
          return `${fieldName} deve ter no máximo ${error.maximum} itens`;
        }
        return `${fieldName} é muito grande`;
        
      case 'invalid_string':
        switch (error.validation) {
          case 'email':
            return `${fieldName} deve ser um email válido`;
          case 'url':
            return `${fieldName} deve ser uma URL válida`;
          case 'uuid':
            return `${fieldName} deve ser um UUID válido`;
          case 'regex':
            return `${fieldName} não atende ao formato exigido`;
          case 'datetime':
            return `${fieldName} deve ser uma data/hora válida`;
          default:
            return `${fieldName} tem formato inválido`;
        }
        
      case 'invalid_enum_value':
        const options = error.options?.join(', ') || 'valores válidos';
        return `${fieldName} deve ser um dos seguintes valores: ${options}`;
        
      case 'custom':
        return error.message || `${fieldName} é inválido`;
        
      default:
        return message || `${fieldName} é inválido`;
    }
  }

  static translateType(type) {
    const types = {
      'string': 'texto',
      'number': 'número',
      'boolean': 'verdadeiro/falso',
      'array': 'lista',
      'object': 'objeto',
      'null': 'nulo',
      'undefined': 'não definido',
      'date': 'data'
    };
    
    return types[type] || type;
  }

  // =====================================================
  // 🎛️ VALIDADORES COMPOSTOS
  // =====================================================

  static validateBodyAndQuery(bodySchema, querySchema) {
    return [
      ValidationMiddleware.validate(bodySchema, 'body'),
      ValidationMiddleware.validate(querySchema, 'query')
    ];
  }

  static validateAll(schemas) {
    const middlewares = [];
    
    if (schemas.body) {
      middlewares.push(ValidationMiddleware.validate(schemas.body, 'body'));
    }
    if (schemas.query) {
      middlewares.push(ValidationMiddleware.validate(schemas.query, 'query'));
    }
    if (schemas.params) {
      middlewares.push(ValidationMiddleware.validate(schemas.params, 'params'));
    }
    if (schemas.headers) {
      middlewares.push(ValidationMiddleware.validate(schemas.headers, 'headers'));
    }
    
    return middlewares;
  }

  // =====================================================
  // 🔒 VALIDADORES ESPECIALIZADOS
  // =====================================================

  static validateId(paramName = 'id') {
    const schema = z.object({
      [paramName]: z.string()
        .uuid('ID deve ser um UUID válido')
        .or(z.string().regex(/^\d+$/, 'ID deve ser um número válido'))
    });

    return ValidationMiddleware.validate(schema, 'params');
  }

  static validatePagination() {
    const schema = z.object({
      page: z.string()
        .regex(/^\d+$/, 'Página deve ser um número')
        .transform(Number)
        .refine(val => val > 0, 'Página deve ser maior que 0')
        .default('1'),
      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 100, 'Limite deve ser entre 1 e 100')
        .default('10'),
      sort: z.string()
        .regex(/^[a-zA-Z_]+$/, 'Campo de ordenação inválido')
        .optional(),
      order: z.enum(['asc', 'desc'], 'Ordem deve ser asc ou desc')
        .default('asc')
    }).partial();

    return ValidationMiddleware.validate(schema, 'query');
  }

  static validateDateRange() {
    const schema = z.object({
      startDate: z.string()
        .datetime('Data inicial deve estar no formato ISO 8601')
        .optional(),
      endDate: z.string()
        .datetime('Data final deve estar no formato ISO 8601')
        .optional()
    }).refine(data => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    }, {
      message: 'Data inicial deve ser menor ou igual à data final',
      path: ['dateRange']
    });

    return ValidationMiddleware.validate(schema, 'query');
  }

  // =====================================================
  // 🎯 VALIDADORES ESPECÍFICOS PARA BARBEARIA
  // =====================================================

  static validateAppointmentTime() {
    const schema = z.object({
      appointmentDate: z.string()
        .datetime('Data do agendamento inválida')
        .refine(date => {
          const appointmentDate = new Date(date);
          const now = new Date();
          return appointmentDate > now;
        }, 'Agendamento deve ser no futuro'),
      
      duration: z.number()
        .int('Duração deve ser um número inteiro')
        .min(15, 'Duração mínima é 15 minutos')
        .max(480, 'Duração máxima é 8 horas')
        .multipleOf(15, 'Duração deve ser múltipla de 15 minutos')
    });

    return ValidationMiddleware.validate(schema, 'body');
  }

  static validateBusinessHours() {
    return (req, res, next) => {
      const { appointmentDate } = req.body;
      
      if (appointmentDate) {
        const date = new Date(appointmentDate);
        const hour = date.getHours();
        const dayOfWeek = date.getDay();

        // Verificar se não é domingo (0) ou segunda (1)
        if (dayOfWeek === 0 || dayOfWeek === 1) {
          return next(AppError.outsideBusinessHours('Não funcionamos aos domingos e segundas-feiras'));
        }

        // Verificar horário de funcionamento (9h às 18h)
        if (hour < 9 || hour >= 18) {
          return next(AppError.outsideBusinessHours('Funcionamento: Terça a Sábado, das 9h às 18h'));
        }
      }

      next();
    };
  }

  static validateRole(allowedRoles) {
    return (req, res, next) => {
      const userRole = req.user?.role;
      
      if (!userRole) {
        return next(AppError.unauthorized('Usuário não autenticado'));
      }
      
      if (!allowedRoles.includes(userRole)) {
        return next(AppError.forbidden(`Acesso negado. Roles permitidas: ${allowedRoles.join(', ')}`));
      }
      
      next();
    };
  }

  // =====================================================
  // 🛠️ UTILITÁRIOS DE VALIDAÇÃO
  // =====================================================

  static sanitizeInput() {
    return (req, res, next) => {
      // Sanitizar strings nos dados de entrada
      const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
          return obj.trim()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/[<>]/g, ''); // Remove brackets
        }
        
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }
        
        if (obj && typeof obj === 'object') {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
          }
          return sanitized;
        }
        
        return obj;
      };

      if (req.body) req.body = sanitizeObject(req.body);
      if (req.query) req.query = sanitizeObject(req.query);
      if (req.params) req.params = sanitizeObject(req.params);

      next();
    };
  }

  static validateContentType(allowedTypes = ['application/json']) {
    return (req, res, next) => {
      if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
      }

      const contentType = req.get('Content-Type')?.split(';')[0];
      
      if (!contentType || !allowedTypes.includes(contentType)) {
        return next(AppError.badRequest(`Content-Type deve ser: ${allowedTypes.join(' ou ')}`));
      }

      next();
    };
  }

  // =====================================================
  // 🚀 MIDDLEWARE COMPOSTO DE VALIDAÇÃO
  // =====================================================

  static createValidationStack(schema, options = {}) {
    const middlewares = [
      ValidationMiddleware.sanitizeInput(),
      ValidationMiddleware.validateContentType()
    ];

    if (options.pagination) {
      middlewares.push(ValidationMiddleware.validatePagination());
    }

    if (options.dateRange) {
      middlewares.push(ValidationMiddleware.validateDateRange());
    }

    if (options.businessHours) {
      middlewares.push(ValidationMiddleware.validateBusinessHours());
    }

    if (options.roles) {
      middlewares.push(ValidationMiddleware.validateRole(options.roles));
    }

    if (schema) {
      if (typeof schema === 'object' && !schema.parse) {
        // Schema object with multiple targets
        middlewares.push(...ValidationMiddleware.validateAll(schema));
      } else {
        // Single schema
        middlewares.push(ValidationMiddleware.validate(schema, options.target || 'body'));
      }
    }

    return middlewares;
  }
}

module.exports = { ValidationMiddleware };