import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { ResponseService, ErrorMessages } from '../utils/responses';

export class AuthController {
  /**
   * Registrar novo usuário
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userData = req.validatedData;
      
      const result = await AuthService.register(userData);
      
      const { response, statusCode } = ResponseService.created(
        'Usuário registrado com sucesso',
        {
          user: result.user,
          tokens: result.tokens,
        }
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Register error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.USER_EMAIL_EXISTS) {
        message = error.message;
        statusCode = 409;
      } else if (error.message === ErrorMessages.USER_PHONE_EXISTS) {
        message = error.message;
        statusCode = 409;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Login do usuário
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const credentials = req.validatedData;
      
      const result = await AuthService.login(credentials);
      
      const { response, statusCode } = ResponseService.success(
        ErrorMessages.LOGIN_SUCCESS,
        {
          user: result.user,
          tokens: result.tokens,
        }
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Login error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.INVALID_CREDENTIALS) {
        message = error.message;
        statusCode = 401;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Renovar access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        const { response, statusCode } = ResponseService.unauthorized(
          ErrorMessages.REFRESH_TOKEN_REQUIRED
        );
        return res.status(statusCode).json(response);
      }
      
      const tokens = await AuthService.refreshToken(refreshToken);
      
      const { response, statusCode } = ResponseService.success(
        'Token renovado com sucesso',
        tokens
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Refresh token error:', error);
      
      const { response, statusCode } = ResponseService.unauthorized(
        ErrorMessages.REFRESH_TOKEN_INVALID
      );
      
      res.status(statusCode).json(response);
    }
  }

  /**
   * Alterar senha
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const passwordData = req.validatedData;
      const userId = req.user!.user_id;
      
      await AuthService.changePassword(userId, passwordData);
      
      const { response, statusCode } = ResponseService.success(
        ErrorMessages.PASSWORD_CHANGED
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Change password error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.USER_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.CURRENT_PASSWORD_INVALID) {
        message = error.message;
        statusCode = 400;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Buscar perfil do usuário autenticado
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.user_id;
      
      const user = await AuthService.getProfile(userId);
      
      const { response, statusCode } = ResponseService.success(
        'Perfil recuperado com sucesso',
        user
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Get profile error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.USER_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Atualizar perfil do usuário autenticado
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const updateData = req.validatedData;
      const userId = req.user!.user_id;
      
      const user = await AuthService.updateProfile(userId, updateData);
      
      const { response, statusCode } = ResponseService.success(
        'Perfil atualizado com sucesso',
        user
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Update profile error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.USER_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      } else if (error.message === ErrorMessages.USER_PHONE_EXISTS) {
        message = error.message;
        statusCode = 409;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Logout do usuário
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      await AuthService.logout();
      
      const { response, statusCode } = ResponseService.success(
        ErrorMessages.LOGOUT_SUCCESS
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Logout error:', error);
      
      const { response, statusCode } = ResponseService.internalError();
      res.status(statusCode).json(response);
    }
  }

  /**
   * Gerar senha temporária (para reset de senha)
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      
      if (!email) {
        const { response, statusCode } = ResponseService.validationError(
          'Email é obrigatório'
        );
        return res.status(statusCode).json(response);
      }
      
      const tempPassword = await AuthService.generateTemporaryPassword(email);
      
      // Em produção, aqui você enviaria a senha por email
      // Por enquanto, retornamos na response (apenas para desenvolvimento)
      const { response, statusCode } = ResponseService.success(
        'Senha temporária gerada com sucesso',
        {
          message: 'Uma senha temporária foi gerada. Em produção seria enviada por email.',
          temporaryPassword: tempPassword // Remover em produção
        }
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      let message = ErrorMessages.INTERNAL_ERROR;
      let statusCode = 500;
      
      if (error.message === ErrorMessages.USER_NOT_FOUND) {
        message = error.message;
        statusCode = 404;
      }
      
      const { response, statusCode: errorStatusCode } = ResponseService.error(
        message,
        undefined,
        statusCode
      );
      
      res.status(errorStatusCode).json(response);
    }
  }

  /**
   * Validar token de acesso (endpoint de verificação)
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const { response, statusCode } = ResponseService.unauthorized(
          ErrorMessages.TOKEN_REQUIRED
        );
        return res.status(statusCode).json(response);
      }
      
      const token = authHeader.split(' ')[1];
      const decoded = await AuthService.validateAccessToken(token);
      
      const { response, statusCode } = ResponseService.success(
        'Token válido',
        {
          valid: true,
          user: decoded,
        }
      );
      
      res.status(statusCode).json(response);
    } catch (error: any) {
      console.error('Validate token error:', error);
      
      const { response, statusCode } = ResponseService.unauthorized(
        ErrorMessages.TOKEN_INVALID
      );
      
      res.status(statusCode).json(response);
    }
  }
}