// =====================================================
// SERVICE DE PAGAMENTOS - LÓGICA DE NEGÓCIO
// =====================================================

const { AppError } = require('../../shared/errors/AppError');
const { Logger } = require('../../utils/Logger');

class PaymentsService {
  constructor(paymentsRepository) {
    this.paymentsRepository = paymentsRepository;
  }

  // =====================================================
  // CRIAR PAGAMENTO
  // =====================================================

  async createPayment(paymentData, user) {
    try {
      Logger.info('Creating payment', { 
        appointmentId: paymentData.appointmentId,
        userId: user.id 
      });

      // Criar pagamento
      const payment = await this.paymentsRepository.create(paymentData);

      return payment;
    } catch (error) {
      Logger.error('Error in createPayment service', error);
      throw error;
    }
  }

  // =====================================================
  // BUSCAR PAGAMENTO POR AGENDAMENTO
  // =====================================================

  async getPaymentByAppointmentId(appointmentId, user) {
    try {
      const payment = await this.paymentsRepository.findByAppointmentId(appointmentId);

      if (!payment) {
        throw AppError.notFound('Pagamento não encontrado para este agendamento');
      }

      // Verificar permissões
      this.checkPaymentAccess(payment, user);

      return payment;
    } catch (error) {
      Logger.error('Error in getPaymentByAppointmentId service', error);
      throw error;
    }
  }

  // =====================================================
  // LISTAR PAGAMENTOS COM FILTROS
  // =====================================================

  async listPayments(filters, user) {
    try {
      // Se não for admin, filtrar apenas pagamentos do barbeiro
      if (user.role === 'barber') {
        filters.barberId = user.id;
      }

      const result = await this.paymentsRepository.findAll(filters);

      return result;
    } catch (error) {
      Logger.error('Error in listPayments service', error);
      throw error;
    }
  }

  // =====================================================
  // ATUALIZAR STATUS (ADMIN APENAS)
  // =====================================================

  async updatePaymentStatus(paymentId, statusData, user) {
    try {
      // Verificar se é admin
      if (user.role !== 'admin') {
        throw AppError.forbidden('Apenas administradores podem alterar o status diretamente');
      }

      Logger.info('Updating payment status', { 
        paymentId, 
        status: statusData.status,
        userId: user.id 
      });

      const payment = await this.paymentsRepository.updateStatus(paymentId, statusData);

      return payment;
    } catch (error) {
      Logger.error('Error in updatePaymentStatus service', error);
      throw error;
    }
  }

  // =====================================================
  // CONFIRMAR PAGAMENTO
  // =====================================================

  async confirmPayment(paymentId, confirmData, user) {
    try {
      // Buscar pagamento
      const payment = await this.paymentsRepository.findById(paymentId);

      if (!payment) {
        throw AppError.notFound('Pagamento não encontrado');
      }

      // Verificar permissões
      if (user.role === 'barber') {
        // Barbeiro só pode confirmar pagamentos dos próprios agendamentos
        if (payment.barberId !== user.id) {
          throw AppError.forbidden('Você não tem permissão para confirmar este pagamento');
        }
      }

      Logger.info('Confirming payment', { 
        paymentId,
        userId: user.id,
        userRole: user.role
      });

      const confirmedPayment = await this.paymentsRepository.confirm(paymentId, confirmData);

      return confirmedPayment;
    } catch (error) {
      Logger.error('Error in confirmPayment service', error);
      throw error;
    }
  }

  // =====================================================
  // PROCESSAR REEMBOLSO (ADMIN APENAS)
  // =====================================================

  async refundPayment(paymentId, reason, user) {
    try {
      // Verificar se é admin
      if (user.role !== 'admin') {
        throw AppError.forbidden('Apenas administradores podem processar reembolsos');
      }

      Logger.info('Processing refund', { 
        paymentId,
        reason,
        userId: user.id 
      });

      const refundedPayment = await this.paymentsRepository.refund(paymentId, reason);

      return refundedPayment;
    } catch (error) {
      Logger.error('Error in refundPayment service', error);
      throw error;
    }
  }

  // =====================================================
  // RELATÓRIO: MÉTODOS DE PAGAMENTO
  // =====================================================

  async getPaymentMethodsReport(startDate, endDate, user) {
    try {
      // Verificar permissões (admin e barber podem ver relatórios)
      if (user.role !== 'admin' && user.role !== 'barber') {
        throw AppError.forbidden('Você não tem permissão para acessar relatórios');
      }

      Logger.info('Generating payment methods report', { 
        startDate,
        endDate,
        userId: user.id 
      });

      const report = await this.paymentsRepository.getPaymentMethodsReport(startDate, endDate);

      return report;
    } catch (error) {
      Logger.error('Error in getPaymentMethodsReport service', error);
      throw error;
    }
  }

  // =====================================================
  // VERIFICAR ACESSO AO PAGAMENTO
  // =====================================================

  checkPaymentAccess(payment, user) {
    // Admin tem acesso a tudo
    if (user.role === 'admin') {
      return true;
    }

    // Barbeiro só pode acessar pagamentos dos próprios agendamentos
    if (user.role === 'barber') {
      if (payment.barberId !== user.id) {
        throw AppError.forbidden('Você não tem permissão para acessar este pagamento');
      }
      return true;
    }

    // Cliente só pode acessar pagamentos dos próprios agendamentos
    if (user.role === 'client') {
      if (payment.userId !== user.id) {
        throw AppError.forbidden('Você não tem permissão para acessar este pagamento');
      }
      return true;
    }

    throw AppError.forbidden('Você não tem permissão para acessar este pagamento');
  }
}

module.exports = { PaymentsService };
