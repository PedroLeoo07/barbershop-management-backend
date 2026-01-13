// =====================================================
// ROTAS DE AGENDAMENTOS
// =====================================================

const express = require('express');
const { AppointmentController } = require('../controllers/appointmentController');
const { authMiddleware } = require('../middlewares/auth');
const { validate } = require('../middlewares/validation');
const { 
  requirePermission, 
  requireOwnershipOrAdmin, 
  requireBarberOrAdmin 
} = require('../middlewares/permissions');
const { 
  createAppointmentSchema, 
  updateAppointmentSchema, 
  appointmentStatusSchema,
  appointmentQuerySchema 
} = require('../utils/validations');
const { Logger } = require('../utils/Logger');

function createAppointmentRoutes(db) {
  const router = express.Router();
  const appointmentController = new AppointmentController(db);

  // Middleware de autenticação para todas as rotas
  router.use(authMiddleware);

  // =====================================================
  // ROTAS PÚBLICAS (AUTENTICADAS)
  // =====================================================

  /**
   * @route GET /api/appointments/my
   * @desc Busca agendamentos do usuário logado
   * @access Private (Client/Barber/Admin)
   */
  router.get(
    '/my',
    validate(appointmentQuerySchema, 'query'),
    appointmentController.getMyAppointments
  );

  /**
   * @route GET /api/appointments/upcoming
   * @desc Busca próximos agendamentos
   * @access Private (Barber/Admin)
   */
  router.get(
    '/upcoming',
    requireBarberOrAdmin,
    appointmentController.getUpcomingAppointments
  );

  /**
   * @route GET /api/appointments/dashboard
   * @desc Dados para dashboard
   * @access Private (Barber/Admin)
   */
  router.get(
    '/dashboard',
    requireBarberOrAdmin,
    appointmentController.getDashboardData
  );

  /**
   * @route GET /api/appointments/statistics
   * @desc Estatísticas de agendamentos
   * @access Private (Barber/Admin)
   */
  router.get(
    '/statistics',
    requireBarberOrAdmin,
    appointmentController.getAppointmentStatistics
  );

  // =====================================================
  // ROTAS POR ID
  // =====================================================

  /**
   * @route POST /api/appointments
   * @desc Cria novo agendamento
   * @access Private (Client/Barber/Admin)
   */
  router.post(
    '/',
    validate(createAppointmentSchema),
    appointmentController.createAppointment
  );

  /**
   * @route GET /api/appointments/:id
   * @desc Busca agendamento por ID
   * @access Private (Own/Barber/Admin)
   */
  router.get(
    '/:id',
    appointmentController.getAppointmentById
  );

  /**
   * @route PUT /api/appointments/:id
   * @desc Atualiza agendamento
   * @access Private (Own/Barber/Admin)
   */
  router.put(
    '/:id',
    validate(updateAppointmentSchema),
    appointmentController.updateAppointment
  );

  /**
   * @route PATCH /api/appointments/:id/status
   * @desc Atualiza status do agendamento
   * @access Private (Own/Barber/Admin)
   */
  router.patch(
    '/:id/status',
    validate(appointmentStatusSchema),
    appointmentController.updateAppointmentStatus
  );

  /**
   * @route PATCH /api/appointments/:id/cancel
   * @desc Cancela agendamento
   * @access Private (Own/Barber/Admin)
   */
  router.patch(
    '/:id/cancel',
    appointmentController.cancelAppointment
  );

  /**
   * @route PATCH /api/appointments/:id/confirm
   * @desc Confirma agendamento
   * @access Private (Barber/Admin)
   */
  router.patch(
    '/:id/confirm',
    requireBarberOrAdmin,
    appointmentController.confirmAppointment
  );

  /**
   * @route PATCH /api/appointments/:id/complete
   * @desc Marca agendamento como concluído
   * @access Private (Barber/Admin)
   */
  router.patch(
    '/:id/complete',
    requireBarberOrAdmin,
    appointmentController.completeAppointment
  );

  // =====================================================
  // ROTAS POR CLIENTE
  // =====================================================

  /**
   * @route GET /api/appointments/client/:clientId
   * @desc Busca agendamentos por cliente
   * @access Private (Own/Admin)
   */
  router.get(
    '/client/:clientId',
    requireOwnershipOrAdmin((req) => req.params.clientId),
    validate(appointmentQuerySchema, 'query'),
    appointmentController.getAppointmentsByClient
  );

  // =====================================================
  // ROTAS POR BARBEIRO
  // =====================================================

  /**
   * @route GET /api/appointments/barber/:barberId
   * @desc Busca agendamentos por barbeiro
   * @access Private (Own/Admin)
   */
  router.get(
    '/barber/:barberId',
    requireOwnershipOrAdmin((req) => req.params.barberId),
    validate(appointmentQuerySchema, 'query'),
    appointmentController.getAppointmentsByBarber
  );

  /**
   * @route GET /api/appointments/barber/:barberId/:date/slots
   * @desc Busca horários disponíveis para um barbeiro em uma data
   * @access Private (All authenticated users)
   */
  router.get(
    '/barber/:barberId/:date/slots',
    appointmentController.getAvailableSlots
  );

  // =====================================================
  // ROTAS POR DATA
  // =====================================================

  /**
   * @route GET /api/appointments/date/:date
   * @desc Busca agendamentos por data
   * @access Private (Admin)
   */
  router.get(
    '/date/:date',
    requirePermission('APPOINTMENT_LIST'),
    appointmentController.getAppointmentsByDate
  );

  // =====================================================
  // MIDDLEWARE DE LOGS
  // =====================================================

  router.use((req, res, next) => {
    if (req.user) {
      Logger.appointment('Appointment route accessed', {
        userId: req.user.id,
        userRole: req.user.role,
        method: req.method,
        path: req.path,
        params: req.params,
        query: req.query
      });
    }
    next();
  });

  return router;
}

module.exports = { createAppointmentRoutes };