// =====================================================
// CONTROLLER DE PAGAMENTOS
// =====================================================

const { successResponse, errorResponse } = require('../../utils/responses');
const { Logger } = require('../../utils/Logger');

class PaymentsController {
  constructor(paymentsService) {
    this.paymentsService = paymentsService;
  }

  // =====================================================
  // POST /api/payments - CRIAR PAGAMENTO
  // =====================================================

  createPayment = async (req, res, next) => {
    try {
      const paymentData = req.body;
      const user = req.user;

      const payment = await this.paymentsService.createPayment(paymentData, user);

      return successResponse(res, payment, 'Pagamento criado com sucesso', 201);
    } catch (error) {
      Logger.error('Error in createPayment controller', error);
      next(error);
    }
  };

  // =====================================================
  // GET /api/payments/appointment/:appointmentId
  // =====================================================

  getPaymentByAppointment = async (req, res, next) => {
    try {
      const { appointmentId } = req.params;
      const user = req.user;

      const payment = await this.paymentsService.getPaymentByAppointmentId(
        appointmentId,
        user
      );

      return successResponse(res, payment);
    } catch (error) {
      Logger.error('Error in getPaymentByAppointment controller', error);
      next(error);
    }
  };

  // =====================================================
  // GET /api/payments - LISTAR PAGAMENTOS
  // =====================================================

  listPayments = async (req, res, next) => {
    try {
      const filters = req.query;
      const user = req.user;

      const result = await this.paymentsService.listPayments(filters, user);

      return successResponse(res, result.data, 'Pagamentos listados com sucesso', 200, {
        pagination: result.pagination
      });
    } catch (error) {
      Logger.error('Error in listPayments controller', error);
      next(error);
    }
  };

  // =====================================================
  // PATCH /api/payments/:paymentId/status
  // =====================================================

  updatePaymentStatus = async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const statusData = req.body;
      const user = req.user;

      const payment = await this.paymentsService.updatePaymentStatus(
        paymentId,
        statusData,
        user
      );

      return successResponse(res, payment, 'Status do pagamento atualizado com sucesso');
    } catch (error) {
      Logger.error('Error in updatePaymentStatus controller', error);
      next(error);
    }
  };

  // =====================================================
  // POST /api/payments/:paymentId/confirm
  // =====================================================

  confirmPayment = async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const confirmData = req.body;
      const user = req.user;

      const payment = await this.paymentsService.confirmPayment(
        paymentId,
        confirmData,
        user
      );

      return successResponse(res, payment, 'Pagamento confirmado com sucesso');
    } catch (error) {
      Logger.error('Error in confirmPayment controller', error);
      next(error);
    }
  };

  // =====================================================
  // POST /api/payments/:paymentId/refund
  // =====================================================

  refundPayment = async (req, res, next) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      const user = req.user;

      const payment = await this.paymentsService.refundPayment(
        paymentId,
        reason,
        user
      );

      return successResponse(res, payment, 'Reembolso processado com sucesso');
    } catch (error) {
      Logger.error('Error in refundPayment controller', error);
      next(error);
    }
  };

  // =====================================================
  // GET /api/reports/payment-methods
  // =====================================================

  getPaymentMethodsReport = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.query;
      const user = req.user;

      const report = await this.paymentsService.getPaymentMethodsReport(
        startDate,
        endDate,
        user
      );

      return successResponse(res, report, 'Relatório gerado com sucesso');
    } catch (error) {
      Logger.error('Error in getPaymentMethodsReport controller', error);
      next(error);
    }
  };
}

module.exports = { PaymentsController };
