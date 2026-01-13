import { Router } from 'express';
import { AppointmentController } from '../controllers/appointmentController';
import { 
  validateBody,
  validateQuery,
  validateParams,
  validateMultiple
} from '../middlewares/validation';
import { 
  authenticate,
  requireBarberOrAdmin,
  requireAdmin 
} from '../middlewares/auth';
import { createResourceRateLimit } from '../middlewares/security';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentFiltersSchema,
  paginationSchema,
  availableSlotsSchema,
  dashboardFiltersSchema
} from '../utils/validations';
import { z } from 'zod';

const router = Router();

// Aplicar autenticação para todas as rotas
router.use(authenticate);

// Schema para validação de ID UUID
const uuidSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

// Schema para reagendamento
const rescheduleSchema = z.object({
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use formato YYYY-MM-DD'),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário inválido. Use formato HH:MM'),
});

// Rotas para agendamentos

/**
 * @route   GET /api/appointments
 * @desc    Listar agendamentos com filtros e paginação
 * @access  Private (Cliente vê apenas seus, Barbeiro vê seus, Admin vê todos)
 */
router.get(
  '/',
  validateQuery(z.object({
    ...paginationSchema.shape,
    ...appointmentFiltersSchema.shape,
  })),
  AppointmentController.getAppointments
);

/**
 * @route   POST /api/appointments
 * @desc    Criar novo agendamento
 * @access  Private (Cliente pode criar para si, Admin pode criar para qualquer)
 */
router.post(
  '/',
  createResourceRateLimit,
  validateBody(createAppointmentSchema),
  AppointmentController.createAppointment
);

/**
 * @route   GET /api/appointments/available-slots
 * @desc    Buscar slots disponíveis para agendamento
 * @access  Private
 */
router.get(
  '/available-slots',
  validateQuery(availableSlotsSchema),
  AppointmentController.getAvailableSlots
);

/**
 * @route   GET /api/appointments/today
 * @desc    Buscar agendamentos de hoje
 * @access  Private (Barbeiro/Admin)
 */
router.get(
  '/today',
  requireBarberOrAdmin,
  AppointmentController.getTodayAppointments
);

/**
 * @route   GET /api/appointments/statistics
 * @desc    Buscar estatísticas de agendamentos
 * @access  Private (Admin)
 */
router.get(
  '/statistics',
  requireAdmin,
  validateQuery(dashboardFiltersSchema),
  AppointmentController.getAppointmentStatistics
);

/**
 * @route   GET /api/appointments/:id
 * @desc    Buscar agendamento por ID
 * @access  Private (Owner, Barber responsável, Admin)
 */
router.get(
  '/:id',
  validateParams(uuidSchema),
  AppointmentController.getAppointmentById
);

/**
 * @route   PUT /api/appointments/:id
 * @desc    Atualizar agendamento
 * @access  Private (Owner, Admin)
 */
router.put(
  '/:id',
  validateParams(uuidSchema),
  validateBody(updateAppointmentSchema),
  AppointmentController.updateAppointment
);

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancelar agendamento
 * @access  Private (Owner, Barber responsável, Admin)
 */
router.delete(
  '/:id',
  validateParams(uuidSchema),
  AppointmentController.cancelAppointment
);

/**
 * @route   PATCH /api/appointments/:id/confirm
 * @desc    Confirmar agendamento
 * @access  Private (Barbeiro/Admin)
 */
router.patch(
  '/:id/confirm',
  requireBarberOrAdmin,
  validateParams(uuidSchema),
  AppointmentController.confirmAppointment
);

/**
 * @route   PATCH /api/appointments/:id/start
 * @desc    Iniciar atendimento
 * @access  Private (Barbeiro/Admin)
 */
router.patch(
  '/:id/start',
  requireBarberOrAdmin,
  validateParams(uuidSchema),
  AppointmentController.startAppointment
);

/**
 * @route   PATCH /api/appointments/:id/complete
 * @desc    Finalizar atendimento
 * @access  Private (Barbeiro/Admin)
 */
router.patch(
  '/:id/complete',
  requireBarberOrAdmin,
  validateParams(uuidSchema),
  AppointmentController.completeAppointment
);

/**
 * @route   PATCH /api/appointments/:id/no-show
 * @desc    Marcar cliente como não compareceu
 * @access  Private (Barbeiro/Admin)
 */
router.patch(
  '/:id/no-show',
  requireBarberOrAdmin,
  validateParams(uuidSchema),
  AppointmentController.markAsNoShow
);

/**
 * @route   PATCH /api/appointments/:id/reschedule
 * @desc    Reagendar agendamento
 * @access  Private (Owner, Admin)
 */
router.patch(
  '/:id/reschedule',
  validateParams(uuidSchema),
  validateBody(rescheduleSchema),
  AppointmentController.rescheduleAppointment
);

export { router as appointmentRoutes };