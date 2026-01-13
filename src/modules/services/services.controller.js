const { ServiceService } = require('./services.service');
const { ServiceSchemas } = require('./services.schemas');
const { ValidationMiddleware } = require('../../middlewares/validation');
const { responses } = require('../../utils/responses');

// =====================================================
// CONTROLADOR DE SERVIÇOS - NOVA ESTRUTURA
// =====================================================

class ServiceController {
  constructor() {
    this.serviceService = new ServiceService();
  }

  // =====================================================
  // 📝 CRIAR NOVO SERVIÇO (APENAS ADMIN)
  // =====================================================

  createService = async (req, res, next) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json(
          responses.error('Apenas administradores podem criar serviços', 403)
        );
      }

      // Validar dados
      const validation = ServiceSchemas.createService.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const serviceData = validation.data;

      // Criar serviço
      const service = await this.serviceService.createService(serviceData);

      return res.status(201).json(
        responses.created('Serviço criado com sucesso', service)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao criar serviço:', error);

      if (error.code === 'SERVICE_NAME_EXISTS') {
        return res.status(409).json(
          responses.conflict('Já existe um serviço com este nome')
        );
      }

  // =====================================================
  // ✏️ ATUALIZAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  updateService = async (req, res, next) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json(
          responses.error('Apenas administradores podem atualizar serviços', 403)
        );
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
      const service = await this.serviceService.updateService(id, updateData);

      return res.status(200).json(
        responses.success('Serviço atualizado com sucesso', service)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao atualizar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return res.status(404).json(
          responses.notFound('Serviço não encontrado')
        );
      }

      if (error.code === 'SERVICE_NAME_EXISTS') {
        return res.status(409).json(
          responses.conflict('Já existe um serviço com este nome')
        );
      }

      if (error.code === 'INVALID_DURATION') {
        return res.status(400).json(
          responses.badRequest(error.message)
        );
      }

      next(error);
    }
  };

  // =====================================================
  // 🗑️ DELETAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  deleteService = async (req, res, next) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json(
          responses.error('Apenas administradores podem deletar serviços', 403)
        );
      }

      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Deletar serviço
      await this.serviceService.deleteService(id);

      return res.status(200).json(
        responses.success('Serviço removido com sucesso')
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao deletar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return res.status(404).json(
          responses.notFound('Serviço não encontrado')
        );
      }

      if (error.code === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
        return res.status(400).json(
          responses.badRequest('Não é possível remover serviço com agendamentos futuros')
        );
      }

      next(error);
    }
  };

  // =====================================================
  // 📋 LISTAR SERVIÇOS (PÚBLICO)
  // =====================================================

  listServices = async (req, res, next) => {
    try {
      // Validar parâmetros de consulta
      const validation = ServiceSchemas.listServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Listar serviços
      const result = await this.serviceService.listServices(params);

      return res.status(200).json(
        responses.success('Serviços listados com sucesso', result)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao listar serviços:', error);
      next(error);
    }
  };

  // =====================================================
  // 🔍 BUSCAR SERVIÇO POR ID (PÚBLICO)
  // =====================================================

  getServiceById = async (req, res, next) => {
    try {
      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Buscar serviço
      const service = await this.serviceService.getServiceById(id);

      return res.status(200).json(
        responses.success('Serviço encontrado com sucesso', service)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviço:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return res.status(404).json(
          responses.notFound('Serviço não encontrado')
        );
      }

      next(error);
    }
  };

  // =====================================================
  // 🔍 BUSCAR SERVIÇOS (PÚBLICO)
  // =====================================================

  searchServices = async (req, res, next) => {
    try {
      // Validar parâmetros de busca
      const validation = ServiceSchemas.searchServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar serviços
      const result = await this.serviceService.searchServices(params.q, params.limit);

      return res.status(200).json(
        responses.success('Busca realizada com sucesso', result)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviços:', error);
      next(error);
    }
  };

  // =====================================================
  // 📊 SERVIÇOS POPULARES (PÚBLICO)
  // =====================================================

  getPopularServices = async (req, res, next) => {
    try {
      // Validar parâmetros
      const validation = ServiceSchemas.popularServices.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar serviços populares
      const result = await this.serviceService.getPopularServices(params.limit, params.days);

      return res.status(200).json(
        responses.success('Serviços populares encontrados', result)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviços populares:', error);
      next(error);
    }
  };

  // =====================================================
  // 🎯 SERVIÇOS ATIVOS (PÚBLICO)
  // =====================================================

  getActiveServices = async (req, res, next) => {
    try {
      const services = await this.serviceService.getActiveServices();

      return res.status(200).json(
        responses.success('Serviços ativos listados com sucesso', services)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao buscar serviços ativos:', error);
      next(error);
    }
  };

  // =====================================================
  // ⏰ DURAÇÃO TOTAL DE SERVIÇOS SELECIONADOS
  // =====================================================

  getServicesDuration = async (req, res, next) => {
    try {
      const { service_ids } = req.body;
      
      if (!Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json(
          responses.badRequest('Lista de IDs de serviços é obrigatória')
        );
      }

      const duration = await this.serviceService.getTotalDuration(service_ids);

      return res.status(200).json(
        responses.success('Duração total calculada com sucesso', { 
          total_duration_minutes: duration 
        })
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao calcular duração:', error);
      next(error);
    }
  };

  // =====================================================
  // 💰 PREÇO TOTAL DE SERVIÇOS SELECIONADOS
  // =====================================================

  getServicesPrice = async (req, res, next) => {
    try {
      const { service_ids } = req.body;
      
      if (!Array.isArray(service_ids) || service_ids.length === 0) {
        return res.status(400).json(
          responses.badRequest('Lista de IDs de serviços é obrigatória')
        );
      }

      const price = await this.serviceService.getTotalPrice(service_ids);

      return res.status(200).json(
        responses.success('Preço total calculado com sucesso', { 
          total_price: price 
        })
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao calcular preço:', error);
      next(error);
    }
  };

  // =====================================================
  // 📱 ALTERNAR STATUS DO SERVIÇO (APENAS ADMIN)
  // =====================================================

  toggleServiceStatus = async (req, res, next) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json(
          responses.error('Apenas administradores podem alterar status', 403)
        );
      }

      // Validar ID
      const idValidation = ServiceSchemas.serviceId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;
      
      const service = await this.serviceService.toggleServiceStatus(id);

      return res.status(200).json(
        responses.success('Status do serviço alterado com sucesso', service)
      );
    } catch (error) {
      console.error('[ServiceController] Erro ao alterar status:', error);

      if (error.code === 'SERVICE_NOT_FOUND') {
        return res.status(404).json(
          responses.notFound('Serviço não encontrado')
        );
      }

      next(error);
    }
  };
}

module.exports = { ServiceController };