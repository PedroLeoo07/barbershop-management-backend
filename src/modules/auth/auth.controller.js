const { AuthService } = require('./auth.service');
const { ResponseUtils } = require('../../shared/utils/responses');
const { AppError } = require('../../shared/errors/AppError');

// =====================================================
// CONTROLLER DE AUTENTICAÇÃO E USUÁRIOS
// =====================================================

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  // =====================================================
  // 📝 REGISTRO DE USUÁRIOS
  // =====================================================

  register = async (req, res, next) => {
    try {
      const userData = req.validated.body;

      const user = await this.authService.register(userData);

      return ResponseUtils.created(res, user, 'Usuário registrado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔑 LOGIN DE USUÁRIOS
  // =====================================================

  login = async (req, res, next) => {
    try {
      const { email, password } = req.validated.body;

      const loginResult = await this.authService.login(email, password);

      return ResponseUtils.authSuccess(
        res, 
        loginResult.accessToken, 
        loginResult.user, 
        loginResult.refreshToken,
        'Login realizado com sucesso'
      );

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔄 REFRESH TOKEN
  // =====================================================

  refreshToken = async (req, res, next) => {
    try {
      const { refreshToken } = req.validated.body;

      const result = await this.authService.refreshToken(refreshToken);

      return ResponseUtils.authSuccess(
        res,
        result.accessToken,
        result.user,
        result.refreshToken,
        'Token renovado com sucesso'
      );

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🚪 LOGOUT
  // =====================================================

  logout = async (req, res, next) => {
    try {
      // O middleware de auth já adiciona o token na blacklist
      // Aqui só confirmamos o logout

      return ResponseUtils.logout(res, 'Logout realizado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 👤 PERFIL DO USUÁRIO
  // =====================================================

  getProfile = async (req, res, next) => {
    try {
      const userId = req.user.id;

      const user = await this.authService.getProfile(userId);

      return ResponseUtils.success(res, user, 'Perfil recuperado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const updateData = req.validated.body;

      const updatedUser = await this.authService.updateProfile(userId, updateData);

      return ResponseUtils.success(res, updatedUser, 'Perfil atualizado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔐 ALTERAÇÃO DE SENHA
  // =====================================================

  changePassword = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.validated.body;

      const result = await this.authService.changePassword(userId, currentPassword, newPassword);

      return ResponseUtils.success(res, result, 'Senha alterada com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 📋 GERENCIAMENTO DE USUÁRIOS (ADMIN)
  // =====================================================

  listUsers = async (req, res, next) => {
    try {
      const requestingUser = req.user;
      const filters = req.validated.query;
      const pagination = {
        page: filters.page || 1,
        limit: filters.limit || 10
      };

      // Remover campos de paginação dos filtros
      delete filters.page;
      delete filters.limit;

      const result = await this.authService.listUsers(requestingUser, filters, pagination);

      return ResponseUtils.paginated(
        res,
        result.users,
        result.pagination,
        'Usuários recuperados com sucesso'
      );

    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req, res, next) => {
    try {
      const { id } = req.validated.params;
      const requestingUser = req.user;

      // Verificar permissão: admin pode ver qualquer usuário, usuário comum só pode ver próprio perfil
      if (requestingUser.role !== 'ADMIN' && requestingUser.id !== id) {
        throw AppError.forbidden('Acesso negado');
      }

      const user = await this.authService.getProfile(id);

      return ResponseUtils.success(res, user, 'Usuário recuperado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  deactivateUser = async (req, res, next) => {
    try {
      const { id } = req.validated.params;
      const requestingUser = req.user;

      const result = await this.authService.deactivateUser(requestingUser, id);

      return ResponseUtils.success(res, result, 'Usuário desativado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  reactivateUser = async (req, res, next) => {
    try {
      const { id } = req.validated.params;
      const requestingUser = req.user;

      const result = await this.authService.reactivateUser(requestingUser, id);

      return ResponseUtils.success(res, result, 'Usuário reativado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔍 BUSCA DE USUÁRIOS (ADMIN)
  // =====================================================

  searchUsers = async (req, res, next) => {
    try {
      const requestingUser = req.user;
      
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem buscar usuários');
      }

      const { q, role, limit } = req.validated.query;

      const users = await this.authService.searchUsers(q, role, limit);

      return ResponseUtils.success(res, users, 'Busca realizada com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 👑 CRIAÇÃO DE ADMIN (SUPER ADMIN)
  // =====================================================

  createAdmin = async (req, res, next) => {
    try {
      const requestingUser = req.user;
      
      // Verificar se é admin (pode ser expandido para super admin)
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem criar outros administradores');
      }

      const adminData = { ...req.validated.body, role: 'ADMIN' };

      const admin = await this.authService.register(adminData);

      return ResponseUtils.created(res, admin, 'Administrador criado com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 📊 ESTATÍSTICAS DE USUÁRIOS (ADMIN)
  // =====================================================

  getUserStats = async (req, res, next) => {
    try {
      const requestingUser = req.user;
      
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem ver estatísticas');
      }

      const stats = await this.authService.getUserStats();

      return ResponseUtils.success(res, stats, 'Estatísticas recuperadas com sucesso');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 🔒 VERIFICAÇÃO DE TOKEN (MIDDLEWARE TESTING)
  // =====================================================

  validateToken = async (req, res, next) => {
    try {
      // Middleware de auth já validou, apenas retornamos dados do usuário
      return ResponseUtils.success(res, {
        valid: true,
        user: req.user,
        tokenInfo: {
          issuedAt: new Date().toISOString(),
          validUntil: 'Based on JWT expiration'
        }
      }, 'Token válido');

    } catch (error) {
      next(error);
    }
  };

  // =====================================================
  // 💡 INFO DA API DE AUTH
  // =====================================================

  getAuthInfo = async (req, res, next) => {
    try {
      const authInfo = {
        service: 'Barbearia Authentication API',
        version: '1.0.0',
        endpoints: {
          public: {
            register: 'POST /auth/register',
            login: 'POST /auth/login',
            refresh: 'POST /auth/refresh'
          },
          authenticated: {
            profile: 'GET /auth/me',
            updateProfile: 'PUT /auth/me',
            changePassword: 'PUT /auth/change-password',
            logout: 'POST /auth/logout'
          },
          admin: {
            listUsers: 'GET /auth/users',
            createAdmin: 'POST /auth/admin',
            deactivateUser: 'PUT /auth/users/:id/deactivate',
            reactivateUser: 'PUT /auth/users/:id/reactivate',
            userStats: 'GET /auth/stats'
          }
        },
        authentication: {
          type: 'JWT Bearer Token',
          header: 'Authorization: Bearer <token>',
          expiration: process.env.JWT_EXPIRES_IN || '24h'
        }
      };

      return ResponseUtils.success(res, authInfo, 'Informações da API de autenticação');

    } catch (error) {
      next(error);
    }
  };
}

module.exports = { AuthController };