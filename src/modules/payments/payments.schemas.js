// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA PAGAMENTOS
// =====================================================

const { z } = require('zod');

// =====================================================
// ENUMS
// =====================================================

const PaymentMethod = z.enum(['pix', 'credit_card', 'debit_card', 'cash'], {
  errorMap: () => ({ message: 'Método de pagamento inválido' })
});

const PaymentStatus = z.enum(['pending', 'paid', 'cancelled', 'refunded'], {
  errorMap: () => ({ message: 'Status de pagamento inválido' })
});

// =====================================================
// SCHEMAS BASE
// =====================================================

const paymentId = z.object({
  paymentId: z.string()
    .min(1, 'Payment ID é obrigatório')
});

const appointmentId = z.object({
  appointmentId: z.string()
    .regex(/^\d+$/, 'Appointment ID deve ser um número')
    .transform(Number)
});

// =====================================================
// SCHEMA PARA CRIAÇÃO DE PAGAMENTO
// =====================================================

const createPayment = z.object({
  appointmentId: z.union([
    z.string().regex(/^\d+$/, 'Appointment ID deve ser um número').transform(Number),
    z.number().int().positive('Appointment ID deve ser um número positivo')
  ]),
  amount: z.number()
    .positive('O valor deve ser maior que zero')
    .multipleOf(0.01, 'O valor deve ter no máximo 2 casas decimais')
    .max(100000, 'O valor não pode exceder R$ 100.000,00'),
  method: PaymentMethod,
  notes: z.string()
    .max(1000, 'Observações não podem exceder 1000 caracteres')
    .optional()
});

// =====================================================
// SCHEMA PARA ATUALIZAR STATUS
// =====================================================

const updatePaymentStatus = z.object({
  status: z.enum(['paid', 'cancelled', 'refunded'], {
    errorMap: () => ({ message: 'Status deve ser: paid, cancelled ou refunded' })
  }),
  transactionId: z.string()
    .max(255, 'Transaction ID não pode exceder 255 caracteres')
    .optional()
});

// =====================================================
// SCHEMA PARA CONFIRMAR PAGAMENTO
// =====================================================

const confirmPayment = z.object({
  method: PaymentMethod.optional(),
  transactionId: z.string()
    .max(255, 'Transaction ID não pode exceder 255 caracteres')
    .optional()
});

// =====================================================
// SCHEMA PARA REEMBOLSO
// =====================================================

const refundPayment = z.object({
  reason: z.string()
    .min(10, 'O motivo do reembolso deve ter pelo menos 10 caracteres')
    .max(1000, 'O motivo não pode exceder 1000 caracteres')
});

// =====================================================
// SCHEMA PARA FILTROS DE LISTAGEM
// =====================================================

const listPaymentsQuery = z.object({
  status: PaymentStatus.optional(),
  method: PaymentMethod.optional(),
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/, 'Data inválida (use formato ISO 8601)')
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/, 'Data inválida (use formato ISO 8601)')
    .optional(),
  barberId: z.string()
    .regex(/^\d+$/, 'Barber ID deve ser um número')
    .transform(Number)
    .optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page deve ser um número')
    .transform(Number)
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit deve ser um número')
    .transform(Number)
    .optional()
    .default('50')
}).refine((data) => {
  // Validar que endDate não é anterior a startDate
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: 'A data final não pode ser anterior à data inicial',
  path: ['endDate']
});

// =====================================================
// SCHEMA PARA RELATÓRIO DE MÉTODOS DE PAGAMENTO
// =====================================================

const paymentMethodsReportQuery = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/, 'Data inicial inválida (use formato ISO 8601)'),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(.\d{3})?Z?)?$/, 'Data final inválida (use formato ISO 8601)')
}).refine((data) => {
  return new Date(data.endDate) >= new Date(data.startDate);
}, {
  message: 'A data final não pode ser anterior à data inicial',
  path: ['endDate']
});

// =====================================================
// EXPORTAÇÕES
// =====================================================

module.exports = {
  // Enums
  PaymentMethod,
  PaymentStatus,
  
  // Schemas de parâmetros
  paymentId,
  appointmentId,
  
  // Schemas de body
  createPayment,
  updatePaymentStatus,
  confirmPayment,
  refundPayment,
  
  // Schemas de query
  listPaymentsQuery,
  paymentMethodsReportQuery
};
