// =====================================================
// ROTAS DE RELATÓRIOS
// =====================================================

const express = require('express');
const { ReportsController } = require('./reports.controller');
const { PaymentsService } = require('../payments/payments.service');
const { PaymentsRepository } = require('../payments/payments.repository');
const { AuthMiddleware } = require('../../shared/middlewares/auth');
const { validate } = require('../../shared/middlewares/validation');
const { paymentMethodsReportQuery } = require('../payments/payments.schemas');

const router = express.Router();

// =====================================================
// INICIALIZAR DEPENDÊNCIAS
// =====================================================

let reportsController;

const initializeController = (pool) => {
  if (!reportsController) {
    const paymentsRepository = new PaymentsRepository(pool);
    const paymentsService = new PaymentsService(paymentsRepository);
    reportsController = new ReportsController(paymentsService);
  }
  return reportsController;
};

// =====================================================
// MIDDLEWARE: VERIFICAR ROLE ADMIN OU BARBER
// =====================================================

const requireAdminOrBarber = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'barber') {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Apenas administradores e barbeiros podem acessar relatórios.'
    });
  }
  next();
};

// =====================================================
// ROTAS DE RELATÓRIOS
// =====================================================

// Todas as rotas requerem autenticação
router.use(AuthMiddleware.authenticate());

// =====================================================
// GET /api/reports/payment-methods
// =====================================================

router.get(
  '/payment-methods',
  requireAdminOrBarber,
  validate(paymentMethodsReportQuery, 'query'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getPaymentMethodsReport(req, res, next);
  }
);

module.exports = router;
