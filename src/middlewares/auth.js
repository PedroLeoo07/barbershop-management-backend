// Middleware básico de autenticação
const authenticate = (req, res, next) => {
  try {
    // Aqui você implementaria a verificação do JWT
    // Por agora, apenas simula um usuário autenticado
    req.user = {
      id: 1,
      email: 'test@example.com',
      role: 'client'
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido ou expirado',
      error: error.message
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a administradores'
    });
  }
};

const requireBarberOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'barber' || req.user.role === 'admin')) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Acesso restrito a barbeiros ou administradores'
    });
  }
};

const requireOwnershipOrAdmin = (req, res, next) => {
  // Implementar lógica de verificação de propriedade ou admin
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireBarberOrAdmin,
  requireOwnershipOrAdmin,
};