import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../utils/jwt';
import { ResponseService, ErrorMessages } from '../utils/responses';
import { UserRole } from '../models';

/**
 * Middleware para verificar se o usuário está autenticado
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);
    
    if (!token) {
      const { response, statusCode } = ResponseService.unauthorized(ErrorMessages.TOKEN_REQUIRED);
      return res.status(statusCode).json(response);
    }
    
    const decoded = JwtService.verifyAccessToken(token);
    req.user = decoded;
    
    next();
  } catch (error: any) {
    let message = ErrorMessages.TOKEN_INVALID;
    
    if (error.message === 'Token expirado') {
      message = ErrorMessages.TOKEN_EXPIRED;
    }
    
    const { response, statusCode } = ResponseService.unauthorized(message);
    return res.status(statusCode).json(response);
  }
};

/**
 * Middleware para verificar se o usuário é um administrador
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    const { response, statusCode } = ResponseService.unauthorized();
    return res.status(statusCode).json(response);
  }
  
  if (req.user.role !== UserRole.ADMIN) {
    const { response, statusCode } = ResponseService.forbidden(ErrorMessages.ADMIN_REQUIRED);
    return res.status(statusCode).json(response);
  }
  
  next();
};

/**
 * Middleware para verificar se o usuário é barbeiro ou admin
 */
export const requireBarberOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    const { response, statusCode } = ResponseService.unauthorized();
    return res.status(statusCode).json(response);
  }
  
  const allowedRoles = [UserRole.BARBER, UserRole.ADMIN];
  if (!allowedRoles.includes(req.user.role as UserRole)) {
    const { response, statusCode } = ResponseService.forbidden(ErrorMessages.BARBER_OR_ADMIN_REQUIRED);
    return res.status(statusCode).json(response);
  }
  
  next();
};

/**
 * Middleware genérico para verificar roles específicos
 */
export const requireRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      const { response, statusCode } = ResponseService.unauthorized();
      return res.status(statusCode).json(response);
    }
    
    if (!roles.includes(req.user.role as UserRole)) {
      const { response, statusCode } = ResponseService.forbidden(ErrorMessages.INSUFFICIENT_PERMISSIONS);
      return res.status(statusCode).json(response);
    }
    
    next();
  };
};

/**
 * Middleware para verificar se o usuário pode acessar recursos próprios ou se é admin
 */
export const requireOwnershipOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      const { response, statusCode } = ResponseService.unauthorized();
      return res.status(statusCode).json(response);
    }
    
    const requestedUserId = req.params[userIdParam] || req.body.user_id || req.validatedData?.user_id;
    const currentUserId = req.user.user_id;
    const userRole = req.user.role as UserRole;
    
    // Admin pode acessar qualquer recurso
    if (userRole === UserRole.ADMIN) {
      return next();
    }
    
    // Usuário pode acessar apenas seus próprios recursos
    if (requestedUserId === currentUserId) {
      return next();
    }
    
    const { response, statusCode } = ResponseService.forbidden(ErrorMessages.ACCESS_DENIED);
    return res.status(statusCode).json(response);
  };
};

/**
 * Middleware opcional de autenticação (não retorna erro se token não existir)
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = JwtService.extractTokenFromHeader(authHeader);
    
    if (token) {
      const decoded = JwtService.verifyAccessToken(token);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Continua sem autenticação se token for inválido
    next();
  }
};