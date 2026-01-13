import { z } from 'zod';
import { UserRole, AppointmentStatus, WeekDay } from '../models';

// Esquemas base para validação
const phoneRegex = /^(\+55\s?)?(\(?\d{2}\)?)\s?\d{4,5}-?\d{4}$/;
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// User Validation Schemas
export const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email inválido').toLowerCase(),
  phone: z.string().regex(phoneRegex, 'Telefone inválido. Use formato: (XX) XXXXX-XXXX'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.CLIENT),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().regex(phoneRegex).optional(),
  is_active: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase(),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Senha atual é obrigatória'),
  new_password: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Nova senha deve conter pelo menos: 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial'),
});

// Barber Validation Schemas
export const createBarberSchema = z.object({
  user_id: z.string().uuid('ID de usuário inválido'),
  specialties: z.string().max(500).optional(),
  commission_rate: z.number().min(0, 'Taxa de comissão não pode ser negativa')
    .max(100, 'Taxa de comissão não pode ser maior que 100%'),
});

export const updateBarberSchema = z.object({
  specialties: z.string().max(500).optional(),
  commission_rate: z.number().min(0).max(100).optional(),
  is_available: z.boolean().optional(),
});

// Service Validation Schemas
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().int().min(5, 'Duração mínima é 5 minutos')
    .max(480, 'Duração máxima é 8 horas'),
  price: z.number().min(0.01, 'Preço deve ser maior que zero'),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().int().min(5).max(480).optional(),
  price: z.number().min(0.01).optional(),
  is_active: z.boolean().optional(),
});

// Business Hours Validation Schemas
export const createBusinessHoursSchema = z.object({
  day_of_week: z.nativeEnum(WeekDay),
  start_time: z.string().regex(timeRegex, 'Horário inválido. Use formato HH:MM'),
  end_time: z.string().regex(timeRegex, 'Horário inválido. Use formato HH:MM'),
}).refine((data) => {
  const start = data.start_time.split(':').map(Number);
  const end = data.end_time.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  return endMinutes > startMinutes;
}, {
  message: 'Horário de fim deve ser maior que horário de início',
  path: ['end_time'],
});

export const updateBusinessHoursSchema = z.object({
  start_time: z.string().regex(timeRegex).optional(),
  end_time: z.string().regex(timeRegex).optional(),
  is_active: z.boolean().optional(),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    const start = data.start_time.split(':').map(Number);
    const end = data.end_time.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return endMinutes > startMinutes;
  }
  return true;
}, {
  message: 'Horário de fim deve ser maior que horário de início',
  path: ['end_time'],
});

// Barber Schedule Validation Schemas
export const createBarberScheduleSchema = z.object({
  barber_id: z.string().uuid('ID de barbeiro inválido'),
  day_of_week: z.nativeEnum(WeekDay),
  start_time: z.string().regex(timeRegex, 'Horário inválido. Use formato HH:MM'),
  end_time: z.string().regex(timeRegex, 'Horário inválido. Use formato HH:MM'),
}).refine((data) => {
  const start = data.start_time.split(':').map(Number);
  const end = data.end_time.split(':').map(Number);
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  return endMinutes > startMinutes;
}, {
  message: 'Horário de fim deve ser maior que horário de início',
  path: ['end_time'],
});

// Appointment Validation Schemas
export const createAppointmentSchema = z.object({
  client_id: z.string().uuid('ID de cliente inválido').optional(), // Opcional pois pode vir do token
  barber_id: z.string().uuid('ID de barbeiro inválido'),
  service_id: z.string().uuid('ID de serviço inválido'),
  appointment_date: z.string().regex(dateRegex, 'Data inválida. Use formato YYYY-MM-DD'),
  start_time: z.string().regex(timeRegex, 'Horário inválido. Use formato HH:MM'),
  notes: z.string().max(500).optional(),
}).refine((data) => {
  const appointmentDate = new Date(data.appointment_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return appointmentDate >= today;
}, {
  message: 'Data do agendamento não pode ser no passado',
  path: ['appointment_date'],
});

export const updateAppointmentSchema = z.object({
  appointment_date: z.string().regex(dateRegex).optional(),
  start_time: z.string().regex(timeRegex).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  notes: z.string().max(500).optional(),
}).refine((data) => {
  if (data.appointment_date) {
    const appointmentDate = new Date(data.appointment_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentDate >= today;
  }
  return true;
}, {
  message: 'Data do agendamento não pode ser no passado',
  path: ['appointment_date'],
});

// Query Parameters Schemas
export const paginationSchema = z.object({
  page: z.string().transform((val) => parseInt(val) || 1).pipe(z.number().min(1)),
  limit: z.string().transform((val) => parseInt(val) || 10).pipe(z.number().min(1).max(100)),
});

export const appointmentFiltersSchema = z.object({
  barber_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  start_date: z.string().regex(dateRegex).optional(),
  end_date: z.string().regex(dateRegex).optional(),
});

export const availableSlotsSchema = z.object({
  barber_id: z.string().uuid().optional(),
  service_id: z.string().uuid('ID de serviço inválido'),
  date: z.string().regex(dateRegex, 'Data inválida. Use formato YYYY-MM-DD'),
}).refine((data) => {
  const requestDate = new Date(data.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return requestDate >= today;
}, {
  message: 'Data não pode ser no passado',
  path: ['date'],
});

// Dashboard Schemas
export const dashboardFiltersSchema = z.object({
  start_date: z.string().regex(dateRegex).optional(),
  end_date: z.string().regex(dateRegex).optional(),
  barber_id: z.string().uuid().optional(),
});

// Validation Helper Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateBarberInput = z.infer<typeof createBarberSchema>;
export type UpdateBarberInput = z.infer<typeof updateBarberSchema>;
export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type CreateBusinessHoursInput = z.infer<typeof createBusinessHoursSchema>;
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>;
export type CreateBarberScheduleInput = z.infer<typeof createBarberScheduleSchema>;
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type AppointmentFiltersInput = z.infer<typeof appointmentFiltersSchema>;
export type AvailableSlotsInput = z.infer<typeof availableSlotsSchema>;
export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;