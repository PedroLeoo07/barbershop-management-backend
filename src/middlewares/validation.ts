import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ResponseService } from '../utils/responses';

// Estender interface Request para incluir dados validados
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
      user?: {
        user_id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware de validação genérico usando Zod
 */
export const validate = (schema: ZodSchema, target: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const dataToValidate = req[target];
      const validatedData = schema.parse(dataToValidate);
      
      // Armazenar dados validados no request
      req.validatedData = validatedData;
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        const { response, statusCode } = ResponseService.validationError(
          'Dados de entrada inválidos',
          errorMessages
        );
        
        return res.status(statusCode).json(response);
      }
      
      const { response, statusCode } = ResponseService.internalError();
      return res.status(statusCode).json(response);
    }
  };
};

/**
 * Middleware para validar corpo da requisição
 */
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');

/**
 * Middleware para validar query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');

/**
 * Middleware para validar parâmetros da URL
 */
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');

/**
 * Middleware para combinar múltiplas validações
 */
export const validateMultiple = (validations: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData: any = {};
      
      // Validar body se fornecido
      if (validations.body) {
        validatedData.body = validations.body.parse(req.body);
      }
      
      // Validar query se fornecido
      if (validations.query) {
        validatedData.query = validations.query.parse(req.query);
      }
      
      // Validar params se fornecido
      if (validations.params) {
        validatedData.params = validations.params.parse(req.params);
      }
      
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        const { response, statusCode } = ResponseService.validationError(
          'Dados de entrada inválidos',
          errorMessages
        );
        
        return res.status(statusCode).json(response);
      }
      
      const { response, statusCode } = ResponseService.internalError();
      return res.status(statusCode).json(response);
    }
  };
};