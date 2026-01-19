// =====================================================
// CONTROLLER DE RELATÓRIOS
// =====================================================

const { successResponse } = require('../../utils/responses');
const { Logger } = require('../../utils/Logger');

class ReportsController {
  constructor(paymentsService) {
    this.paymentsService = paymentsService;
  }

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

module.exports = { ReportsController };
