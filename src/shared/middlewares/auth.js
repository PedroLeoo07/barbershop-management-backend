const jwt = require('jsonwebtoken');
const { AppError } = require('../errors/AppError');

// =====================================================
// MIDDLEWARE DE AUTENTICAÇÃO JWT PROFISSIONAL
// =====================================================

class AuthMiddleware {
  // =====================================================
  // 🔑 MIDDLEWARE PRINCIPAL DE AUTENTICAÇÃO
  // =====================================================

  static authenticate() {
    return async (req, res, next) => {
      try {
        // Extrair token do header
        const token = AuthMiddleware.extractToken(req);
        
        if (!token) {
          return next(AppError.unauthorized('Token de acesso requerido'));
        }

        // Verificar e decodificar token
        const decoded = AuthMiddleware.verifyToken(token);
        
        // Verificar se o token não está na blacklist
        if (AuthMiddleware.isTokenBlacklisted(token)) {
          return next(AppError.unauthorized('Token invalidado'));
        }

        // Verificar se o usuário ainda existe e está ativo
        const user = await AuthMiddleware.validateUser(decoded.userId);
        
        if (!user) {
          return next(AppError.unauthorized('Usuário não encontrado ou inativo'));
        }

        // Anexar dados do usuário na request
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt
        };

        req.token = token;

        // Log da autenticação
        console.log(`✅ User authenticated: ${user.email} (${user.role})`);

        next();
      } catch (error) {
        // Tratar erros específicos do JWT
        if (error.name === 'JsonWebTokenError') {
          return next(AppError.unauthorized('Token inválido'));
        }
        if (error.name === 'TokenExpiredError') {
          return next(AppError.tokenExpired('Token expirado'));
        }
        if (error.name === 'NotBeforeError') {
          return next(AppError.unauthorized('Token ainda não é válido'));
        }

        next(error);
      }
    };
  }

  // =====================================================
  // 🔓 MIDDLEWARE OPCIONAL DE AUTENTICAÇÃO
  // =====================================================

  static optionalAuth() {
    return async (req, res, next) => {
      try {
        const token = AuthMiddleware.extractToken(req);
        
        if (token) {
          const decoded = AuthMiddleware.verifyToken(token);
          const user = await AuthMiddleware.validateUser(decoded.userId);
          
          if (user && !AuthMiddleware.isTokenBlacklisted(token)) {
            req.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              name: user.name,
              isActive: user.isActive
            };
          }
        }

        next();
      } catch (error) {
        // Em autenticação opcional, ignoramos erros e continuamos
        next();
      }
    };
  }

  // =====================================================
  // 🛡️ MIDDLEWARE DE AUTORIZAÇÃO POR ROLE
  // =====================================================

  static authorize(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return next(AppError.unauthorized('Autenticação requerida'));
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];
      
      if (!allowedRoles.includes(req.user.role)) {
        console.warn(`🚫 Access denied for user ${req.user.email}: required ${allowedRoles.join('|')}, has ${req.user.role}`);
        
        return next(AppError.forbidden(
          `Acesso negado. Permissão requerida: ${allowedRoles.join(' ou ')}`
        ));
      }

      next();
    };
  }

  // =====================================================
  // 🎯 MIDDLEWARE ESPECÍFICOS POR ROLE
  // =====================================================

  static requireAdmin() {
    return AuthMiddleware.authorize(['admin']);
  }

  static requireBarber() {
    return AuthMiddleware.authorize(['admin', 'barber']);
  }

  static requireCustomer() {
    return AuthMiddleware.authorize(['admin', 'barber', 'customer']);
  }

  // =====================================================
  // 🔍 MIDDLEWARE DE VERIFICAÇÃO DE RECURSOS
  // =====================================================

  static requireOwnership(resourceField = 'userId') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next(AppError.unauthorized('Autenticação requerida'));
        }

        // Admins podem acessar qualquer recurso
        if (req.user.role === 'admin') {
          return next();
        }

        // Extrair ID do recurso dos parâmetros ou body
        const resourceId = req.params.id || req.body.id;
        
        if (!resourceId) {
          return next(AppError.badRequest('ID do recurso não fornecido'));
        }

        // Verificar propriedade do recurso
        const hasOwnership = await AuthMiddleware.checkResourceOwnership(
          req.user.id,
          resourceId,
          resourceField
        );

        if (!hasOwnership) {
          return next(AppError.forbidden('Acesso negado ao recurso'));
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  // =====================================================
  // 🛠️ MÉTODOS AUXILIARES
  // =====================================================

  static extractToken(req) {
    // Extrair do header Authorization
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Extrair de cookie (opcional)
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    // Extrair de query parameter (não recomendado para produção)
    if (process.env.NODE_ENV === 'development' && req.query.token) {
      return req.query.token;
    }

    return null;
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw error;
    }
  }

  static async validateUser(userId) {
    // Aqui você faria a consulta no banco de dados
    // Por enquanto, retorno um mock - substituir pela implementação real
    
    try {
      // Simular consulta no banco
      // const user = await User.findById(userId);
      
      // Mock temporário
      return {
        id: userId,
        email: 'user@example.com',
        role: 'customer',
        name: 'Mock User',
        isActive: true,
        lastLoginAt: new Date()
      };
    } catch (error) {
      console.error('Error validating user:', error);
      return null;
    }
  }

  static async checkResourceOwnership(userId, resourceId, resourceField) {
    // Implementar verificação de propriedade do recurso
    // Por enquanto, retorno true - substituir pela implementação real
    
    try {
      // Exemplo de verificação para agendamentos:
      // const appointment = await Appointment.findById(resourceId);
      // return appointment && appointment[resourceField] === userId;
      
      return true; // Mock temporário
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return false;
    }
  }

  // =====================================================
  // 🚫 SISTEMA DE BLACKLIST DE TOKENS
  // =====================================================

  static tokenBlacklist = new Set();

  static addToBlacklist(token) {
    AuthMiddleware.tokenBlacklist.add(token);
    
    // Auto-limpeza após expiração
    setTimeout(() => {
      AuthMiddleware.tokenBlacklist.delete(token);
    }, 24 * 60 * 60 * 1000); // 24 horas
  }

  static isTokenBlacklisted(token) {
    return AuthMiddleware.tokenBlacklist.has(token);
  }

  static clearBlacklist() {
    AuthMiddleware.tokenBlacklist.clear();
  }

  // =====================================================
  // 🔐 MIDDLEWARE DE LOGOUT
  // =====================================================

  static logout() {
    return (req, res, next) => {
      if (req.token) {
        AuthMiddleware.addToBlacklist(req.token);
        console.log(`🚪 User logged out: ${req.user?.email}`);
      }

      req.user = null;
      req.token = null;

      res.status(200).json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    };
  }

  // =====================================================
  // 🔄 MIDDLEWARE DE REFRESH TOKEN
  // =====================================================

  static refreshToken() {
    return async (req, res, next) => {
      try {
        const token = AuthMiddleware.extractToken(req);
        
        if (!token) {
          return next(AppError.unauthorized('Token requerido'));
        }

        // Verificar token mesmo que expirado
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
          if (error.name === 'TokenExpiredError') {
            decoded = jwt.decode(token);
          } else {
            return next(AppError.unauthorized('Token inválido'));
          }
        }

        // Verificar se não passou muito tempo desde a expiração (7 dias)
        const now = Math.floor(Date.now() / 1000);
        const maxRefreshTime = 7 * 24 * 60 * 60; // 7 dias
        
        if (now - decoded.exp > maxRefreshTime) {
          return next(AppError.unauthorized('Token muito antigo para refresh'));
        }

        // Validar usuário
        const user = await AuthMiddleware.validateUser(decoded.userId);
        if (!user) {
          return next(AppError.unauthorized('Usuário não encontrado'));
        }

        // Gerar novo token
        const newToken = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Blacklist do token antigo
        AuthMiddleware.addToBlacklist(token);

        res.json({
          success: true,
          data: {
            token: newToken,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            }
          }
        });

      } catch (error) {
        next(error);
      }
    };
  }

  // =====================================================
  // 📊 MIDDLEWARE DE RATE LIMITING POR USUÁRIO
  // =====================================================

  static userRateLimit(options = {}) {
    const { windowMs = 15 * 60 * 1000, max = 100 } = options;
    const userRequests = new Map();

    return (req, res, next) => {
      if (!req.user) {
        return next();
      }

      const userId = req.user.id;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Limpar requests antigos
      const userRequestTimes = userRequests.get(userId) || [];
      const validRequests = userRequestTimes.filter(time => time > windowStart);

      if (validRequests.length >= max) {
        return next(AppError.tooManyRequests(
          `Limite de ${max} requisições por usuário excedido`
        ));
      }

      validRequests.push(now);
      userRequests.set(userId, validRequests);

      next();
    };
  }

  // =====================================================
  // 🔒 MIDDLEWARE DE VERIFICAÇÃO DE CONTA ATIVA
  // =====================================================

  static requireActiveAccount() {
    return (req, res, next) => {
      if (!req.user) {
        return next(AppError.unauthorized('Autenticação requerida'));
      }

      if (!req.user.isActive) {
        return next(AppError.forbidden('Conta desativada. Contate o administrador.'));
      }

      next();
    };
  }

  // =====================================================
  // 🎯 MIDDLEWARE COMPOSTOS
  // =====================================================

  static requireAdminAuth() {
    return [
      AuthMiddleware.authenticate(),
      AuthMiddleware.requireActiveAccount(),
      AuthMiddleware.requireAdmin()
    ];
  }

  static requireBarberAuth() {
    return [
      AuthMiddleware.authenticate(),
      AuthMiddleware.requireActiveAccount(),
      AuthMiddleware.requireBarber()
    ];
  }

  static requireCustomerAuth() {
    return [
      AuthMiddleware.authenticate(),
      AuthMiddleware.requireActiveAccount(),
      AuthMiddleware.requireCustomer()
    ];
  }
}

module.exports = { AuthMiddleware };