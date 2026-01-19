// =====================================================
// ROTAS DE PAGAMENTOS
// =====================================================

const express = require('express');
const { PaymentsController } = require('./payments.controller');
const { PaymentsService } = require('./payments.service');
const { PaymentsRepository } = require('./payments.repository');
const { AuthMiddleware } = require('../../shared/middlewares/auth');
const { validate } = require('../../shared/middlewares/validation');
const {
  createPayment,
  updatePaymentStatus,
  confirmPayment,
  refundPayment,
  listPaymentsQuery,
  paymentMethodsReportQuery,
  paymentId,
  appointmentId
} = require('./payments.schemas');

const router = express.Router();

// =====================================================
// INICIALIZAR DEPENDÊNCIAS
// =====================================================

let paymentsController;

const initializeController = (pool) => {
  if (!paymentsController) {
    const paymentsRepository = new PaymentsRepository(pool);
    const paymentsService = new PaymentsService(paymentsRepository);
    paymentsController = new PaymentsController(paymentsService);
  }
  return paymentsController;
};

// =====================================================
// MIDDLEWARE: VERIFICAR ROLE ADMIN
// =====================================================

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores podem realizar esta ação.'
    });
  }
  next();
};

// =====================================================
// MIDDLEWARE: VERIFICAR ROLE ADMIN OU BARBER
// =====================================================

const requireAdminOrBarber = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'barber') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores e barbeiros podem realizar esta ação.'
    });
  }
  next();
};

// =====================================================
// ROTAS DE PAGAMENTOS
// =====================================================

// Todas as rotas requerem autenticação
router.use(AuthMiddleware.authenticate());

// =====================================================
// POST /api/payments - CRIAR PAGAMENTO
// =====================================================

router.post(
  '/',
  requireAdminOrBarber,
  validate(createPayment, 'body'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.createPayment(req, res, next);
  }
);

// =====================================================
// GET /api/payments/appointment/:appointmentId
// =====================================================

router.get(
  '/appointment/:appointmentId',
  validate(appointmentId, 'params'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getPaymentByAppointment(req, res, next);
  }
);

// =====================================================
// GET /api/payments - LISTAR PAGAMENTOS
// =====================================================

router.get(
  '/',
  validate(listPaymentsQuery, 'query'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.listPayments(req, res, next);
  }
);

// =====================================================
// PATCH /api/payments/:paymentId/status - ATUALIZAR STATUS
// =====================================================

router.patch(
  '/:paymentId/status',
  requireAdmin,
  validate(paymentId, 'params'),
  validate(updatePaymentStatus, 'body'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.updatePaymentStatus(req, res, next);
  }
);

// =====================================================
// POST /api/payments/:paymentId/confirm - CONFIRMAR PAGAMENTO
// =====================================================

router.post(
  '/:paymentId/confirm',
  requireAdminOrBarber,
  validate(paymentId, 'params'),
  validate(confirmPayment, 'body'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.confirmPayment(req, res, next);
  }
);

// =====================================================
// POST /api/payments/:paymentId/refund - PROCESSAR REEMBOLSO
// =====================================================

router.post(
  '/:paymentId/refund',
  requireAdmin,
  validate(paymentId, 'params'),
  validate(refundPayment, 'body'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.refundPayment(req, res, next);
  }
);

module.exports = router;
