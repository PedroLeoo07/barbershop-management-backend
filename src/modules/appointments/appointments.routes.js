// =====================================================
// ROTAS DE AGENDAMENTOS PROFISSIONAIS
// =====================================================

const express = require('express');
const { AppointmentsController } = require('./appointments.controller');
const { authMiddleware } = require('../../shared/middlewares/auth.middleware');
const { roleMiddleware } = require('../../shared/middlewares/role.middleware');
const { validationMiddleware } = require('../../shared/middlewares/validation.middleware');
const { rateLimitMiddleware } = require('../../shared/middlewares/rate-limit.middleware');
const { appointmentSchemas } = require('./appointments.schemas');

const router = express.Router();

// =====================================================
// INICIALIZAR CONTROLLER
// =====================================================

let appointmentsController;

const initializeController = (pool) => {
  if (!appointmentsController) {
    appointmentsController = new AppointmentsController(pool);
  }
  return appointmentsController;
};

// =====================================================
// MIDDLEWARE PADRÃO PARA TODAS AS ROTAS
// =====================================================

router.use(authMiddleware); // Todas as rotas requerem autenticação

// =====================================================
// 🔥 ROTAS PRINCIPAIS DE AGENDAMENTO
// =====================================================

// 📅 BUSCAR HORÁRIOS DISPONÍVEIS
// GET /api/appointments/barber/:barberId/date/:date/slots
router.get(
  '/barber/:barberId/date/:date/slots',
  rateLimitMiddleware({ maxRequests: 30, windowMs: 15 * 60 * 1000 }), // 30 req/15min
  validationMiddleware(appointmentSchemas.getAvailableSlots, 'params'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getAvailableSlots(req, res, next);
  }
);

// 🔍 PRÓXIMO HORÁRIO DISPONÍVEL
// GET /api/appointments/barber/:barberId/next-available
router.get(
  '/barber/:barberId/next-available',
  rateLimitMiddleware({ maxRequests: 20, windowMs: 15 * 60 * 1000 }), // 20 req/15min
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getNextAvailable(req, res, next);
  }
);

// 🔥 CRIAR AGENDAMENTO (FLUXO PROFISSIONAL)
// POST /api/appointments
router.post(
  '/',
  rateLimitMiddleware({ maxRequests: 10, windowMs: 15 * 60 * 1000 }), // 10 criações/15min
  validationMiddleware(appointmentSchemas.createAppointment),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.createAppointment(req, res, next);
  }
);

// 📊 DASHBOARD DE AGENDAMENTOS
// GET /api/appointments/dashboard
router.get(
  '/dashboard',
  roleMiddleware(['admin', 'barber']), // Apenas admin e barbeiros
  rateLimitMiddleware({ maxRequests: 60, windowMs: 15 * 60 * 1000 }), // 60 req/15min
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getDashboard(req, res, next);
  }
);

// 📊 ESTATÍSTICAS RÁPIDAS
// GET /api/appointments/stats
router.get(
  '/stats',
  roleMiddleware(['admin', 'barber']), // Apenas admin e barbeiros
  rateLimitMiddleware({ maxRequests: 30, windowMs: 15 * 60 * 1000 }), // 30 req/15min
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getQuickStats(req, res, next);
  }
);

// 📅 AGENDAMENTOS DE HOJE
// GET /api/appointments/today
router.get(
  '/today',
  rateLimitMiddleware({ maxRequests: 60, windowMs: 15 * 60 * 1000 }), // 60 req/15min
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getTodayAppointments(req, res, next);
  }
);

// =====================================================
// 📋 ROTAS DE LISTAGEM E BUSCA
// =====================================================

// 📋 LISTAR AGENDAMENTOS COM FILTROS
// GET /api/appointments
router.get(
  '/',
  rateLimitMiddleware({ maxRequests: 60, windowMs: 15 * 60 * 1000 }), // 60 req/15min
  validationMiddleware(appointmentSchemas.listAppointments, 'query'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getAppointments(req, res, next);
  }
);

// 🔍 BUSCAR AGENDAMENTO POR ID
// GET /api/appointments/:id
router.get(
  '/:id',
  validationMiddleware(appointmentSchemas.appointmentId, 'params'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getAppointmentById(req, res, next);
  }
);

// =====================================================
// 🔄 ROTAS DE ATUALIZAÇÃO DE STATUS
// =====================================================

// 🔄 ATUALIZAR STATUS (GENÉRICO)
// PATCH /api/appointments/:id/status
router.patch(
  '/:id/status',
  rateLimitMiddleware({ maxRequests: 20, windowMs: 15 * 60 * 1000 }), // 20 updates/15min
  validationMiddleware(appointmentSchemas.appointmentId, 'params'),
  validationMiddleware(appointmentSchemas.updateStatus),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.updateAppointmentStatus(req, res, next);
  }
);

// ❌ CANCELAR AGENDAMENTO
// PATCH /api/appointments/:id/cancel
router.patch(
  '/:id/cancel',
  rateLimitMiddleware({ maxRequests: 15, windowMs: 15 * 60 * 1000 }), // 15 cancellations/15min
  validationMiddleware(appointmentSchemas.appointmentId, 'params'),
  validationMiddleware(appointmentSchemas.cancelAppointment),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.cancelAppointment(req, res, next);
  }
);

// ✅ CONFIRMAR AGENDAMENTO (APENAS BARBEIROS E ADMIN)
// PATCH /api/appointments/:id/confirm
router.patch(
  '/:id/confirm',
  roleMiddleware(['admin', 'barber']), // Apenas barbeiros e admin podem confirmar
  rateLimitMiddleware({ maxRequests: 20, windowMs: 15 * 60 * 1000 }), // 20 confirmations/15min
  validationMiddleware(appointmentSchemas.appointmentId, 'params'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.confirmAppointment(req, res, next);
  }
);

// 🏁 COMPLETAR AGENDAMENTO (APENAS BARBEIROS E ADMIN)
// PATCH /api/appointments/:id/complete
router.patch(
  '/:id/complete',
  roleMiddleware(['admin', 'barber']), // Apenas barbeiros e admin podem completar
  rateLimitMiddleware({ maxRequests: 20, windowMs: 15 * 60 * 1000 }), // 20 completions/15min
  validationMiddleware(appointmentSchemas.appointmentId, 'params'),
  validationMiddleware(appointmentSchemas.completeAppointment),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.completeAppointment(req, res, next);
  }
);

// =====================================================
// 📅 ROTAS ESPECÍFICAS POR BARBEIRO/CLIENTE
// =====================================================

// 👨‍💼 AGENDAMENTOS POR BARBEIRO
// GET /api/appointments/barber/:barberId
router.get(
  '/barber/:barberId',
  roleMiddleware(['admin', 'barber']), // Barbeiro só vê próprios agendamentos
  validationMiddleware(appointmentSchemas.getByBarber, 'params'),
  (req, res, next) => {
    // Barbeiro só pode ver próprios agendamentos
    if (req.user.role === 'barber' && req.params.barberId !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para ver agendamentos de outro barbeiro'
      });
    }

    const controller = initializeController(req.app.locals.pool);
    controller.getAppointments(req, res, next);
  }
);

// 👤 AGENDAMENTOS POR CLIENTE
// GET /api/appointments/client/:userId
router.get(
  '/client/:userId',
  roleMiddleware(['admin', 'client']), // Admin e próprio cliente
  validationMiddleware(appointmentSchemas.getByClient, 'params'),
  (req, res, next) => {
    // Cliente só pode ver próprios agendamentos
    if (req.user.role === 'client' && req.params.userId !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para ver agendamentos de outro cliente'
      });
    }

    const controller = initializeController(req.app.locals.pool);
    controller.getAppointments(req, res, next);
  }
);

// 📅 AGENDAMENTOS POR DATA
// GET /api/appointments/date/:date
router.get(
  '/date/:date',
  roleMiddleware(['admin', 'barber']), // Apenas admin e barbeiros
  validationMiddleware(appointmentSchemas.getByDate, 'params'),
  (req, res, next) => {
    const controller = initializeController(req.app.locals.pool);
    controller.getAppointments(req, res, next);
  }
);

// =====================================================
// 🔄 MEUS AGENDAMENTOS (SHORTCUT)
// =====================================================

// 👤 MEUS AGENDAMENTOS
// GET /api/appointments/my
router.get(
  '/my',
  rateLimitMiddleware({ maxRequests: 60, windowMs: 15 * 60 * 1000 }), // 60 req/15min
  (req, res, next) => {
    // Adiciona filtro baseado no papel do usuário
    if (req.user.role === 'client') {
      req.query.userId = req.user.id;
    } else if (req.user.role === 'barber') {
      req.query.barberId = req.user.id;
    }

    const controller = initializeController(req.app.locals.pool);
    controller.getAppointments(req, res, next);
  }
);

// =====================================================
// 📊 ROTAS DE RELATÓRIOS (APENAS ADMIN)
// =====================================================

// 📈 RELATÓRIO DE OCUPAÇÃO
// GET /api/appointments/reports/occupancy
router.get(
  '/reports/occupancy',
  roleMiddleware(['admin']), // Apenas admin
  rateLimitMiddleware({ maxRequests: 10, windowMs: 15 * 60 * 1000 }), // 10 reports/15min
  (req, res, next) => {
    // TODO: Implementar relatório de ocupação
    res.status(501).json({
      success: false,
      message: 'Relatório de ocupação em desenvolvimento'
    });
  }
);

// 💰 RELATÓRIO DE RECEITA
// GET /api/appointments/reports/revenue
router.get(
  '/reports/revenue',
  roleMiddleware(['admin']), // Apenas admin
  rateLimitMiddleware({ maxRequests: 10, windowMs: 15 * 60 * 1000 }), // 10 reports/15min
  (req, res, next) => {
    // TODO: Implementar relatório de receita
    res.status(501).json({
      success: false,
      message: 'Relatório de receita em desenvolvimento'
    });
  }
);

// =====================================================
// MIDDLEWARE DE TRATAMENTO DE ERROS
// =====================================================

router.use((error, req, res, next) => {
  const { Logger } = require('../../shared/utils/Logger');
  
  Logger.appointment('Route error', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    error: error.message,
    stack: error.stack
  });

  next(error); // Passa para o error handler global
});

module.exports = (pool) => {
  // Inicializa o controller com o pool de conexões
  initializeController(pool);
  return router;
};