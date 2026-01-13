// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA AGENDAMENTOS
// =====================================================

const { z } = require('zod');

// =====================================================
// SCHEMAS BASE
// =====================================================

const appointmentId = z.object({
  id: z.string().regex(/^\d+$/, 'ID deve ser um número').transform(Number)
});

const barberId = z.object({
  barberId: z.string().regex(/^\d+$/, 'Barber ID deve ser um número').transform(Number)
});

const dateParam = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
});

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

// =====================================================
// SCHEMA PARA CRIAÇÃO DE AGENDAMENTO
// =====================================================

const createAppointment = z.object({
  user_id: z.number().int().positive('User ID deve ser um número positivo'),
  barber_id: z.number().int().positive('Barber ID deve ser um número positivo'),
  service_id: z.number().int().positive('Service ID deve ser um número positivo'),
  appointment_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .refine((date) => {
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return appointmentDate >= today;
    }, 'Não é possível agendar no passado'),
  appointment_time: z.string()
    .regex(timeRegex, 'Horário deve estar no formato HH:MM'),
  duration: z.number().int().min(15).max(240).optional().default(30),
  notes: z.string().max(500, 'Observações não podem exceder 500 caracteres').optional()
}).refine((data) => {
  // Validação adicional: não permite agendamento com mais de 60 dias
  const appointmentDate = new Date(data.appointment_date);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  return appointmentDate <= maxDate;
}, {
  message: 'Não é possível agendar com mais de 60 dias de antecedência',
  path: ['appointment_date']
});

// =====================================================
// SCHEMA PARA BUSCAR HORÁRIOS DISPONÍVEIS
// =====================================================

const getAvailableSlots = z.object({
  barberId: z.string().regex(/^\d+$/, 'Barber ID deve ser um número').transform(Number),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
    .refine((date) => {
      const targetDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return targetDate >= today;
    }, 'Não é possível buscar horários no passado')
});

// =====================================================
// SCHEMA PARA LISTAGEM DE AGENDAMENTOS
// =====================================================

const listAppointments = z.object({
  barberId: z.string().regex(/^\d+$/, 'Barber ID deve ser um número').transform(Number).optional(),
  userId: z.string().regex(/^\d+$/, 'User ID deve ser um número').transform(Number).optional(),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD').optional(),
  page: z.string().regex(/^\d+$/, 'Page deve ser um número').transform(Number).min(1).optional().default(1),
  limit: z.string().regex(/^\d+$/, 'Limit deve ser um número').transform(Number).min(1).max(100).optional().default(20)
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: 'Data inicial deve ser anterior à data final',
  path: ['startDate']
});

// =====================================================
// SCHEMA PARA ATUALIZAÇÃO DE STATUS
// =====================================================

const updateStatus = z.object({
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], {
    required_error: 'Status é obrigatório',
    invalid_type_error: 'Status deve ser um dos valores válidos'
  }),
  notes: z.string().max(500, 'Observações não podem exceder 500 caracteres').optional()
});

// =====================================================
// SCHEMA PARA CANCELAMENTO
// =====================================================

const cancelAppointment = z.object({
  reason: z.string()
    .min(1, 'Motivo do cancelamento é obrigatório')
    .max(500, 'Motivo não pode exceder 500 caracteres')
    .optional()
});

// =====================================================
// SCHEMA PARA CONCLUSÃO
// =====================================================

const completeAppointment = z.object({
  notes: z.string().max(500, 'Observações não podem exceder 500 caracteres').optional(),
  rating: z.number().int().min(1).max(5).optional()
});

// =====================================================
// SCHEMAS PARA ROTAS ESPECÍFICAS
// =====================================================

const getByBarber = z.object({
  barberId: z.string().regex(/^\d+$/, 'Barber ID deve ser um número').transform(Number)
});

const getByClient = z.object({
  userId: z.string().regex(/^\d+$/, 'User ID deve ser um número').transform(Number)
});

const getByDate = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
});

// =====================================================
// SCHEMA PARA QUERY PARAMETERS DE SLOTS
// =====================================================

const slotsQuery = z.object({
  serviceDuration: z.string().regex(/^\d+$/, 'Duração deve ser um número').transform(Number).min(15).max(240).optional().default(30),
  serviceId: z.string().regex(/^\d+$/, 'Service ID deve ser um número').transform(Number).optional()
});

// =====================================================
// SCHEMAS DE VALIDAÇÃO CUSTOMIZADA
// =====================================================

const validateBusinessHours = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const timeInMinutes = hours * 60 + minutes;
  const openTime = 9 * 60; // 09:00
  const closeTime = 18 * 60; // 18:00
  
  return timeInMinutes >= openTime && timeInMinutes < closeTime;
};

const validateWorkDays = (date) => {
  const dayOfWeek = new Date(date).getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 6; // Segunda a sábado
};

// Schema com validações de horário comercial
const createAppointmentWithBusinessRules = createAppointment.refine((data) => {
  return validateBusinessHours(data.appointment_time);
}, {
  message: 'Horário deve estar entre 09:00 e 18:00',
  path: ['appointment_time']
}).refine((data) => {
  return validateWorkDays(data.appointment_date);
}, {
  message: 'Agendamentos apenas de segunda a sábado',
  path: ['appointment_date']
});

// =====================================================
// EXPORT DOS SCHEMAS
// =====================================================

module.exports = {
  appointmentSchemas: {
    // Operações principais
    createAppointment: createAppointmentWithBusinessRules,
    updateStatus,
    cancelAppointment,
    completeAppointment,
    
    // Busca e filtros
    listAppointments,
    getAvailableSlots,
    slotsQuery,
    
    // Identificadores
    appointmentId,
    barberId,
    dateParam,
    
    // Rotas específicas
    getByBarber,
    getByClient,
    getByDate
  },
  
  // Validadores utilitários
  validators: {
    validateBusinessHours,
    validateWorkDays,
    timeRegex
  }
};