const { ServiceService } = require('./services.service');
const { ServiceSchemas } = require('./services.schemas');
const { ValidationMiddleware } = require('../../middlewares/validation');
const { ResponseUtils } = require('../../utils/responses');

// =====================================================
// CONTROLLER PARA SERVIÇOS - ADMIN CRUD + PUBLIC READ
// =====================================================

class ServiceController {
  constructor() {
    this.serviceService = new ServiceService();
  }

  // =====================================================
  // ➕ CRIAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  createService = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem criar serviços');
      }

      // Validar dados
      const validation = ServiceSchemas.createService.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const serviceData = validation.data;

      // Criar serviço
      const service = await this.serviceService.createService(serviceData, req.user.id);

      return ResponseUtils.success(res, service, 'Serviço criado com sucesso', 201);
    } catch (error) {
      console.error('[ServiceController] Erro ao criar serviço:', error);

      if (error.code === 'SERVICE_NAME_EXISTS') {
        return ResponseUtils.conflict(res, 'Já existe um serviço com este nome');
      }

      if (error.code === 'INVALID_PRICE_RANGE') {
        return ResponseUtils.badRequest(res, error.message);
      }

      if (error.code === 'INVALID_DURATION_RANGE') {
        return ResponseUtils.badRequest(res, error.message);
      }

      if (error.code === 'INVALID_CATEGORY') {
        return ResponseUtils.badRequest(res, error.message);
      }

      return ResponseUtils.error(res, 'Erro interno ao criar serviço');
    }
  };

  // =====================================================
  // ✏️ ATUALIZAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  updateService = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem atualizar serviços');
      }

      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Validar dados de atualização
      const validation = ServiceSchemas.updateService.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const updateData = validation.data;

      // Atualizar serviço
      const service = await this.serviceService.updateService(id, updateData, req.user.id);

      return ResponseUtils.success(res, service, 'Serviço atualizado com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao atualizar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Serviço não encontrado');
      }

      if (error.code === 'SERVICE_NAME_EXISTS') {
        return ResponseUtils.conflict(res, 'Já existe um serviço com este nome');
      }

      if (error.code === 'INVALID_PRICE_RANGE') {
        return ResponseUtils.badRequest(res, error.message);
      }

      if (error.code === 'INVALID_DURATION_RANGE') {
        return ResponseUtils.badRequest(res, error.message);
      }

      return ResponseUtils.error(res, 'Erro interno ao atualizar serviço');
    }
  };

  // =====================================================
  // 🗑️ DELETAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  deleteService = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem deletar serviços');
      }

      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Deletar serviço (soft delete)
      await this.serviceService.deleteService(id, req.user.id);

      return ResponseUtils.success(res, null, 'Serviço removido com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao deletar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Serviço não encontrado');
      }

      if (error.code === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
        return ResponseUtils.badRequest(res, 'Não é possível remover serviço com agendamentos futuros');
      }

      return ResponseUtils.error(res, 'Erro interno ao deletar serviço');
    }
  };

  // =====================================================
  // 📋 LISTAR SERVIÇOS (PÚBLICO)
  // =====================================================

  listServices = async (req, res) => {
    try {
      // Validar parâmetros de consulta
      const validation = ServiceSchemas.listServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Listar serviços
      const result = await this.serviceService.listServices(params);

      return ResponseUtils.success(res, result, 'Serviços listados com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao listar serviços:', error);
      return ResponseUtils.error(res, 'Erro interno ao listar serviços');
    }
  };

  // =====================================================
  // 🔍 BUSCAR SERVIÇO POR ID (PÚBLICO)
  // =====================================================

  getServiceById = async (req, res) => {
    try {
      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Buscar serviço
      const service = await this.serviceService.getServiceById(id);

      return ResponseUtils.success(res, service, 'Serviço encontrado com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Serviço não encontrado');
      }

      return ResponseUtils.error(res, 'Erro interno ao buscar serviço');
    }
  };

  // =====================================================
  // 🔍 BUSCAR SERVIÇOS (PÚBLICO)
  // =====================================================

  searchServices = async (req, res) => {
    try {
      // Validar parâmetros de busca
      const validation = ServiceSchemas.searchServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar serviços
      const result = await this.serviceService.searchServices(params.q, params.limit);

      return ResponseUtils.success(res, result, 'Busca realizada com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviços:', error);
      return ResponseUtils.error(res, 'Erro interno ao buscar serviços');
    }
  };

  // =====================================================
  // 📊 SERVIÇOS POPULARES (PÚBLICO)
  // =====================================================

  getPopularServices = async (req, res) => {
    try {
      // Validar parâmetros
      const validation = ServiceSchemas.popularServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar serviços populares
      const result = await this.serviceService.getPopularServices(params.limit, params.days);

      return ResponseUtils.success(res, result, 'Serviços populares encontrados');
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviços populares:', error);
      return ResponseUtils.error(res, 'Erro interno ao buscar serviços populares');
    }
  };

  // =====================================================
  // 📊 RELATÓRIO DE RECEITA (APENAS ADMIN)
  // =====================================================

  getServiceRevenue = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem acessar relatórios de receita');
      }

      // Validar parâmetros
      const validation = ServiceSchemas.serviceRevenue.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Obter relatório de receita
      const revenue = await this.serviceService.getServiceRevenue(params);

      return ResponseUtils.success(res, revenue, 'Relatório de receita gerado com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao gerar relatório de receita:', error);
      return ResponseUtils.error(res, 'Erro interno ao gerar relatório de receita');
    }
  };

  // =====================================================
  // 📂 CATEGORIAS DE SERVIÇOS (PÚBLICO)
  // =====================================================

  getCategories = async (req, res) => {
    try {
      // Buscar categorias
      const result = await this.serviceService.getCategories();

      return ResponseUtils.success(res, result, 'Categorias encontradas com sucesso');
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar categorias:', error);
      return ResponseUtils.error(res, 'Erro interno ao buscar categorias');
    }
  };
}

module.exports = { ServiceController };