const express = require('express');
const { AuthController } = require('./auth.controller');
const { AuthSchemas } = require('./auth.schemas');
const { ValidationMiddleware } = require('../../shared/middlewares/validation');
const { AuthMiddleware } = require('../../shared/middlewares/auth');
const { RateLimiter } = require('../../shared/middlewares/rateLimiter');

// =====================================================
// ROTAS DE AUTENTICAÇÃO E USUÁRIOS
// =====================================================

const router = express.Router();
const authController = new AuthController();

// =====================================================
// 📋 INFO DA API
// =====================================================

router.get('/', authController.getAuthInfo);

// =====================================================
// 🔓 ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// =====================================================

// Registro de usuários com rate limiting
router.post('/register', [
  RateLimiter.auth(), // 5 tentativas por 15 min
  ValidationMiddleware.validate(AuthSchemas.register, 'body')
], authController.register);

// Login com rate limiting rigoroso
router.post('/login', [
  RateLimiter.auth(), // 5 tentativas por 15 min
  ValidationMiddleware.validate(AuthSchemas.login, 'body')
], authController.login);

// Refresh token
router.post('/refresh', [
  RateLimiter.general(),
  ValidationMiddleware.validate(AuthSchemas.refreshToken, 'body')
], authController.refreshToken);

// =====================================================
// 🔒 ROTAS PROTEGIDAS (REQUER AUTENTICAÇÃO)
// =====================================================

// Middleware de autenticação para todas as rotas abaixo
router.use(AuthMiddleware.authenticate());

// Logout
router.post('/logout', 
  RateLimiter.general(),
  AuthMiddleware.logout()
);

// Validação de token (para testing)
router.get('/validate',
  RateLimiter.general(),
  authController.validateToken
);

// =====================================================
// 👤 PERFIL DO USUÁRIO
// =====================================================

// Obter perfil atual
router.get('/me',
  RateLimiter.general(),
  authController.getProfile
);

// Atualizar perfil
router.put('/me', [
  RateLimiter.modifications(),
  ValidationMiddleware.validate(AuthSchemas.updateProfile, 'body')
], authController.updateProfile);

// Alterar senha
router.put('/change-password', [
  RateLimiter.auth(), // Rate limit rigoroso para alteração de senha
  ValidationMiddleware.validate(AuthSchemas.changePassword, 'body')
], authController.changePassword);

// =====================================================
// 🛡️ ROTAS ADMINISTRATIVAS (APENAS ADMIN)
// =====================================================

// Middleware para verificar role de admin
const requireAdmin = AuthMiddleware.requireAdmin();

// Listar usuários
router.get('/users', [
  requireAdmin,
  RateLimiter.dashboard(),
  ValidationMiddleware.validate(AuthSchemas.listUsers, 'query')
], authController.listUsers);

// Buscar usuários
router.get('/users/search', [
  requireAdmin,
  RateLimiter.search(),
  ValidationMiddleware.validate(AuthSchemas.searchUsers, 'query')
], authController.searchUsers);

// Estatísticas de usuários
router.get('/stats', [
  requireAdmin,
  RateLimiter.dashboard()
], authController.getUserStats);

// Obter usuário por ID
router.get('/users/:id', [
  requireAdmin,
  RateLimiter.general(),
  ValidationMiddleware.validate(AuthSchemas.userId, 'params')
], authController.getUserById);

// Criar novo administrador
router.post('/admin', [
  requireAdmin,
  RateLimiter.auth(),
  ValidationMiddleware.validate(AuthSchemas.createAdmin, 'body')
], authController.createAdmin);

// Desativar usuário
router.put('/users/:id/deactivate', [
  requireAdmin,
  RateLimiter.modifications(),
  ValidationMiddleware.validate(AuthSchemas.userId, 'params')
], authController.deactivateUser);

// Reativar usuário
router.put('/users/:id/reactivate', [
  requireAdmin,
  RateLimiter.modifications(),
  ValidationMiddleware.validate(AuthSchemas.userId, 'params')
], authController.reactivateUser);

// =====================================================
// 🚫 MIDDLEWARE DE TRATAMENTO DE ERROS ESPECÍFICO
// =====================================================

router.use((error, req, res, next) => {
  // Log específico para erros de autenticação
  if (error.statusCode === 401) {
    console.warn(`🔒 Auth failed: ${req.ip} - ${req.method} ${req.originalUrl}`);
  }
  
  if (error.statusCode === 403) {
    console.warn(`🚫 Access denied: ${req.user?.email || 'unknown'} - ${req.method} ${req.originalUrl}`);
  }

  next(error);
});

module.exports = router;