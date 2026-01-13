const { Router } = require('express');
const { AuthController } = require('../controllers/authController');
const { 
  validateBody,
  validateQuery,
  validateMultiple
} = require('../middlewares/validation');
const { 
  authenticate,
  requireAdmin,
  requireOwnershipOrAdmin 
} = require('../middlewares/auth');
const { authRateLimit } = require('../middlewares/security');
const {
  createUserSchema,
  loginSchema,
  changePasswordSchema,
  updateUserSchema
} = require('../utils/validations');

const router = Router();

// Rotas públicas (sem autenticação)
router.post(
  '/register',
  authRateLimit,
  validateBody(createUserSchema),
  AuthController.register
);

router.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  AuthController.login
);

router.post(
  '/refresh-token',
  AuthController.refreshToken
);

router.post(
  '/forgot-password',
  authRateLimit,
  AuthController.forgotPassword
);

router.post(
  '/validate-token',
  AuthController.validateToken
);

// Rotas protegidas (requerem autenticação)
router.use(authenticate); // Aplicar autenticação para todas as rotas abaixo

router.get(
  '/profile',
  AuthController.getProfile
);

router.put(
  '/profile',
  validateBody(updateUserSchema),
  AuthController.updateProfile
);

router.put(
  '/change-password',
  validateBody(changePasswordSchema),
  AuthController.changePassword
);

router.post(
  '/logout',
  AuthController.logout
);

module.exports = { authRoutes: router };