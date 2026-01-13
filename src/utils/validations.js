// =====================================================
// VALIDAÇÕES CENTRALIZADAS COM ZOD
// =====================================================

const { z } = require('zod');

// =====================================================
// VALIDAÇÕES BÁSICAS REUTILIZÁVEIS
// =====================================================

const baseValidations = {
  id: z.number().int().positive('ID deve ser um número positivo'),
  uuid: z.string().uuid('UUID inválido'),
  email: z.string().email('Email inválido').toLowerCase(),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (11) 99999-9999'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Horário deve estar no formato HH:MM'),
  role: z.enum(['client', 'barber', 'admin'], 'Papel deve ser client, barber ou admin'),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'], 'Status inválido'),
  paymentStatus: z.enum(['pending', 'paid', 'refunded'], 'Status de pagamento inválido')
};

// =====================================================
// SCHEMAS DE USUÁRIOS
// =====================================================

const createUserSchema = z.object({
  email: baseValidations.email,
  password: baseValidations.password,
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo'),
  phone: baseValidations.phone.optional(),
  role: baseValidations.role.default('client')
});

const updateUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo').optional(),
  phone: baseValidations.phone.optional(),
  email: baseValidations.email.optional()
});

const loginSchema = z.object({
  email: baseValidations.email,
  password: z.string().min(1, 'Senha é obrigatória')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: baseValidations.password,
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword']
});

// =====================================================
// SCHEMAS DE SERVIÇOS
// =====================================================

const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome do serviço deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  duration: z.number().int().min(5, 'Duração mínima é 5 minutos').max(480, 'Duração máxima é 8 horas'),
  price: z.number().positive('Preço deve ser positivo').multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais'),
  category: z.string().max(100, 'Categoria muito longa').optional(),
  is_active: z.boolean().default(true)
});

const updateServiceSchema = createServiceSchema.partial();

// =====================================================
// SCHEMAS DE AGENDAMENTOS
// =====================================================

const createAppointmentSchema = z.object({
  user_id: baseValidations.id,
  barber_id: baseValidations.id,
  service_id: baseValidations.id,
  appointment_date: baseValidations.date,
  start_time: baseValidations.time,
  notes: z.string().max(500, 'Notas muito longas').optional()
}).refine((data) => {
  const appointmentDate = new Date(data.appointment_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return appointmentDate >= today;
}, {
  message: 'Não é possível agendar para datas passadas',
  path: ['appointment_date']
});

const updateAppointmentSchema = z.object({
  appointment_date: baseValidations.date.optional(),
  start_time: baseValidations.time.optional(),
  status: baseValidations.status.optional(),
  notes: z.string().max(500, 'Notas muito longas').optional(),
  payment_status: baseValidations.paymentStatus.optional(),
  payment_method: z.string().max(50, 'Método de pagamento muito longo').optional()
});

// =====================================================
// SCHEMAS DE BARBEIROS
// =====================================================

const createBarberSchema = z.object({
  user_id: baseValidations.id,
  bio: z.string().max(1000, 'Bio muito longa').optional(),
  experience_years: z.number().int().min(0, 'Anos de experiência deve ser positivo').max(50, 'Anos de experiência muito alto').default(0),
  specialties: z.array(z.string().max(100, 'Especialidade muito longa')).optional(),
  hourly_rate: z.number().positive('Taxa por hora deve ser positiva').multipleOf(0.01).optional(),
  commission_rate: z.number().min(0, 'Taxa de comissão deve ser positiva').max(100, 'Taxa de comissão máxima é 100%').default(0),
  is_available: z.boolean().default(true)
});

const updateBarberSchema = createBarberSchema.partial().omit({ user_id: true });

// =====================================================
// SCHEMAS DE FILTROS E PAGINAÇÃO
// =====================================================

const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/, 'Página deve ser um número').transform(Number).refine(n => n > 0, 'Página deve ser maior que 0').default('1'),
  limit: z.string().regex(/^\d+$/, 'Limit deve ser um número').transform(Number).refine(n => n > 0 && n <= 100, 'Limit deve ser entre 1 e 100').default('10'),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

const appointmentFiltersSchema = z.object({
  barber_id: z.string().regex(/^\d+$/, 'ID do barbeiro deve ser um número').transform(Number).optional(),
  user_id: z.string().regex(/^\d+$/, 'ID do usuário deve ser um número').transform(Number).optional(),
  status: baseValidations.status.optional(),
  date_from: baseValidations.date.optional(),
  date_to: baseValidations.date.optional(),
  service_id: z.string().regex(/^\d+$/, 'ID do serviço deve ser um número').transform(Number).optional()
}).merge(paginationSchema);

const availableSlotsSchema = z.object({
  barber_id: baseValidations.id,
  date: baseValidations.date,
  service_id: baseValidations.id
});

// =====================================================
// SCHEMAS DE HORÁRIOS DE FUNCIONAMENTO
// =====================================================

const businessHoursSchema = z.object({
  day_of_week: z.number().int().min(0, 'Dia da semana deve ser entre 0 e 6').max(6, 'Dia da semana deve ser entre 0 e 6'),
  opening_time: baseValidations.time,
  closing_time: baseValidations.time,
  is_active: z.boolean().default(true)
}).refine((data) => data.opening_time < data.closing_time, {
  message: 'Horário de abertura deve ser anterior ao de fechamento',
  path: ['closing_time']
});

// =====================================================
// SCHEMAS PARA DASHBOARD
// =====================================================

const dashboardFiltersSchema = z.object({
  period: z.enum(['today', 'week', 'month', 'year']).default('week'),
  date_from: baseValidations.date.optional(),
  date_to: baseValidations.date.optional(),
  barber_id: z.string().regex(/^\d+$/, 'ID do barbeiro deve ser um número').transform(Number).optional()
});

module.exports = {
  // Validações básicas
  baseValidations,
  
  // Usuários
  createUserSchema,
  updateUserSchema,
  loginSchema,
  changePasswordSchema,
  
  // Serviços
  createServiceSchema,
  updateServiceSchema,
  
  // Agendamentos
  createAppointmentSchema,
  updateAppointmentSchema,
  
  // Barbeiros
  createBarberSchema,
  updateBarberSchema,
  
  // Filtros e paginação
  paginationSchema,
  appointmentFiltersSchema,
  availableSlotsSchema,
  
  // Horários de funcionamento
  businessHoursSchema,
  
  // Dashboard
  dashboardFiltersSchema
};