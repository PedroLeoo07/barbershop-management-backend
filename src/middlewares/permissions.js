// =====================================================
// SISTEMA DE PERMISSÕES GRANULARES
// =====================================================

const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

// =====================================================
// DEFINIÇÃO DE PERMISSÕES
// =====================================================

const PERMISSIONS = {
  // Usuários
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_LIST: 'user:list',

  // Barbeiros
  BARBER_CREATE: 'barber:create',
  BARBER_READ: 'barber:read',
  BARBER_UPDATE: 'barber:update',
  BARBER_DELETE: 'barber:delete',
  BARBER_LIST: 'barber:list',
  BARBER_SCHEDULE_MANAGE: 'barber:schedule:manage',

  // Serviços
  SERVICE_CREATE: 'service:create',
  SERVICE_READ: 'service:read',
  SERVICE_UPDATE: 'service:update',
  SERVICE_DELETE: 'service:delete',
  SERVICE_LIST: 'service:list',

  // Agendamentos
  APPOINTMENT_CREATE: 'appointment:create',
  APPOINTMENT_READ: 'appointment:read',
  APPOINTMENT_UPDATE: 'appointment:update',
  APPOINTMENT_DELETE: 'appointment:delete',
  APPOINTMENT_LIST: 'appointment:list',
  APPOINTMENT_CONFIRM: 'appointment:confirm',
  APPOINTMENT_CANCEL: 'appointment:cancel',
  APPOINTMENT_COMPLETE: 'appointment:complete',

  // Dashboard e relatórios
  DASHBOARD_VIEW: 'dashboard:view',
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export',

  // Configurações
  SETTINGS_UPDATE: 'settings:update',
  BUSINESS_HOURS_MANAGE: 'business_hours:manage',

  // Sistema
  SYSTEM_ADMIN: 'system:admin',
  LOGS_VIEW: 'logs:view'
};

// =====================================================
// MAPEAMENTO DE ROLES PARA PERMISSÕES
// =====================================================

const ROLE_PERMISSIONS = {
  admin: [
    // Todas as permissões
    ...Object.values(PERMISSIONS)
  ],

  barber: [
    // Usuários (limitado)
    PERMISSIONS.USER_READ,

    // Barbeiros (próprio perfil)
    PERMISSIONS.BARBER_READ,
    PERMISSIONS.BARBER_UPDATE,
    PERMISSIONS.BARBER_SCHEDULE_MANAGE,

    // Serviços (leitura)
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_LIST,

    // Agendamentos (próprios)
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_LIST,
    PERMISSIONS.APPOINTMENT_UPDATE,
    PERMISSIONS.APPOINTMENT_CONFIRM,
    PERMISSIONS.APPOINTMENT_COMPLETE,

    // Dashboard básico
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],

  client: [
    // Usuários (próprio perfil)
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,

    // Barbeiros (leitura)
    PERMISSIONS.BARBER_READ,
    PERMISSIONS.BARBER_LIST,

    // Serviços (leitura)
    PERMISSIONS.SERVICE_READ,
    PERMISSIONS.SERVICE_LIST,

    // Agendamentos (próprios)
    PERMISSIONS.APPOINTMENT_CREATE,
    PERMISSIONS.APPOINTMENT_READ,
    PERMISSIONS.APPOINTMENT_LIST,
    PERMISSIONS.APPOINTMENT_CANCEL
  ]
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

/**
 * Verifica se um usuário tem uma permissão específica
 */
function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission) || rolePermissions.includes(PERMISSIONS.SYSTEM_ADMIN);
}

/**
 * Verifica se é o próprio usuário ou admin
 */
function isOwnerOrAdmin(currentUserId, targetUserId, userRole) {
  return userRole === 'admin' || currentUserId === targetUserId;
}

/**
 * Verifica se é o barbeiro responsável ou admin
 */
function isBarberOrAdmin(currentUserId, barberId, userRole) {
  return userRole === 'admin' || currentUserId === barberId;
}

// =====================================================
// MIDDLEWARES DE PERMISSÃO
// =====================================================

/**
 * Middleware para verificar permissão específica
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        const error = AppError.unauthorized('Usuário não autenticado');
        return res.status(error.statusCode).json(error.toJSON());
      }

      if (!hasPermission(user.role, permission)) {
        Logger.security('Permission denied', {
          userId: user.id,
          role: user.role,
          requiredPermission: permission,
          url: req.url,
          method: req.method
        });

        const error = AppError.forbidden('Permissão insuficiente');
        return res.status(error.statusCode).json(error.toJSON());
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar múltiplas permissões (OR)
 */
const requireAnyPermission = (permissions) => {
  return (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        const error = AppError.unauthorized('Usuário não autenticado');
        return res.status(error.statusCode).json(error.toJSON());
      }

      const hasAnyPermission = permissions.some(permission => hasPermission(user.role, permission));

      if (!hasAnyPermission) {
        Logger.security('Multiple permissions denied', {
          userId: user.id,
          role: user.role,
          requiredPermissions: permissions,
          url: req.url,
          method: req.method
        });

        const error = AppError.forbidden('Permissão insuficiente');
        return res.status(error.statusCode).json(error.toJSON());
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar se é admin
 */
const requireAdmin = requirePermission(PERMISSIONS.SYSTEM_ADMIN);

/**
 * Middleware para verificar se é barbeiro ou admin
 */
const requireBarberOrAdmin = requireAnyPermission([
  PERMISSIONS.BARBER_READ,
  PERMISSIONS.SYSTEM_ADMIN
]);

/**
 * Middleware para verificar ownership ou admin
 */
const requireOwnershipOrAdmin = (getUserIdFromRequest = (req) => req.params.id) => {
  return (req, res, next) => {
    try {
      const currentUser = req.user;
      const targetUserId = Number(getUserIdFromRequest(req));

      if (!currentUser) {
        const error = AppError.unauthorized('Usuário não autenticado');
        return res.status(error.statusCode).json(error.toJSON());
      }

      if (!isOwnerOrAdmin(currentUser.id, targetUserId, currentUser.role)) {
        Logger.security('Ownership check failed', {
          currentUserId: currentUser.id,
          targetUserId,
          role: currentUser.role,
          url: req.url,
          method: req.method
        });

        const error = AppError.forbidden('Acesso negado: você só pode acessar seus próprios dados');
        return res.status(error.statusCode).json(error.toJSON());
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar se é o barbeiro responsável ou admin
 */
const requireBarberOwnershipOrAdmin = (getBarberIdFromRequest = (req) => req.params.barberId) => {
  return (req, res, next) => {
    try {
      const currentUser = req.user;
      const targetBarberId = Number(getBarberIdFromRequest(req));

      if (!currentUser) {
        const error = AppError.unauthorized('Usuário não autenticado');
        return res.status(error.statusCode).json(error.toJSON());
      }

      if (!isBarberOrAdmin(currentUser.id, targetBarberId, currentUser.role)) {
        Logger.security('Barber ownership check failed', {
          currentUserId: currentUser.id,
          targetBarberId,
          role: currentUser.role,
          url: req.url,
          method: req.method
        });

        const error = AppError.forbidden('Acesso negado: você só pode gerenciar seus próprios dados');
        return res.status(error.statusCode).json(error.toJSON());
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  isOwnerOrAdmin,
  isBarberOrAdmin,
  requirePermission,
  requireAnyPermission,
  requireAdmin,
  requireBarberOrAdmin,
  requireOwnershipOrAdmin,
  requireBarberOwnershipOrAdmin
};