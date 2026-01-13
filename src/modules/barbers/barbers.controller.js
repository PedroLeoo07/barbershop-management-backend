const { BarberService } = require('./barbers.service');
const { BarberSchemas } = require('./barbers.schemas');
const { ValidationMiddleware } = require('../../middlewares/validation');
const { ResponseUtils } = require('../../utils/responses');

// =====================================================
// CONTROLLER PARA BARBEIROS - APENAS ADMINS
// =====================================================

class BarberController {
  constructor() {
    this.barberService = new BarberService();
  }

  // =====================================================
  // 👨‍💼 CRIAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  createBarber = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem criar barbeiros');
      }

      // Validar dados
      const validation = BarberSchemas.createBarber.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const barberData = validation.data;

      // Criar barbeiro
      const barber = await this.barberService.createBarber(barberData, req.user.id);

      return ResponseUtils.success(res, barber, 'Barbeiro criado com sucesso', 201);
    } catch (error) {
      console.error('[BarberController] Erro ao criar barbeiro:', error);

      if (error.code === 'USER_NOT_FOUND') {
        return ResponseUtils.badRequest(res, 'Usuário não encontrado');
      }

      if (error.code === 'USER_ALREADY_BARBER') {
        return ResponseUtils.conflict(res, 'Este usuário já é um barbeiro');
      }

      return ResponseUtils.error(res, 'Erro interno ao criar barbeiro');
    }
  };

  // =====================================================
  // ✏️ ATUALIZAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  updateBarber = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem atualizar barbeiros');
      }

      // Validar ID
      const idValidation = BarberSchemas.barberId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Validar dados de atualização
      const validation = BarberSchemas.updateBarber.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const updateData = validation.data;

      // Atualizar barbeiro
      const barber = await this.barberService.updateBarber(id, updateData, req.user.id);

      return ResponseUtils.success(res, barber, 'Barbeiro atualizado com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao atualizar barbeiro:', error);

      if (error.code === 'BARBER_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Barbeiro não encontrado');
      }

      if (error.code === 'USER_NOT_FOUND') {
        return ResponseUtils.badRequest(res, 'Usuário não encontrado');
      }

      if (error.code === 'USER_ALREADY_BARBER') {
        return ResponseUtils.conflict(res, 'Este usuário já está associado a outro barbeiro');
      }

      return ResponseUtils.error(res, 'Erro interno ao atualizar barbeiro');
    }
  };

  // =====================================================
  // 🗑️ DELETAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  deleteBarber = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem deletar barbeiros');
      }

      // Validar ID
      const idValidation = BarberSchemas.barberId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Deletar barbeiro (soft delete)
      await this.barberService.deleteBarber(id, req.user.id);

      return ResponseUtils.success(res, null, 'Barbeiro removido com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao deletar barbeiro:', error);

      if (error.code === 'BARBER_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Barbeiro não encontrado');
      }

      if (error.code === 'BARBER_HAS_FUTURE_APPOINTMENTS') {
        return ResponseUtils.badRequest(res, 'Não é possível remover barbeiro com agendamentos futuros');
      }

      return ResponseUtils.error(res, 'Erro interno ao deletar barbeiro');
    }
  };

  // =====================================================
  // 📋 LISTAR BARBEIROS (PÚBLICO)
  // =====================================================

  listBarbers = async (req, res) => {
    try {
      // Validar parâmetros de consulta
      const validation = BarberSchemas.listBarbers.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Listar barbeiros
      const result = await this.barberService.listBarbers(params);

      return ResponseUtils.success(res, result, 'Barbeiros listados com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao listar barbeiros:', error);
      return ResponseUtils.error(res, 'Erro interno ao listar barbeiros');
    }
  };

  // =====================================================
  // 🔍 BUSCAR BARBEIRO POR ID (PÚBLICO)
  // =====================================================

  getBarberById = async (req, res) => {
    try {
      // Validar ID
      const idValidation = BarberSchemas.barberId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Buscar barbeiro
      const barber = await this.barberService.getBarberById(id);

      return ResponseUtils.success(res, barber, 'Barbeiro encontrado com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao buscar barbeiro:', error);

      if (error.code === 'BARBER_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Barbeiro não encontrado');
      }

      return ResponseUtils.error(res, 'Erro interno ao buscar barbeiro');
    }
  };

  // =====================================================
  // 🔍 BUSCAR BARBEIROS (PÚBLICO)
  // =====================================================

  searchBarbers = async (req, res) => {
    try {
      // Validar parâmetros de busca
      const validation = BarberSchemas.searchBarbers.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar barbeiros
      const barbers = await this.barberService.searchBarbers(params.q, params.limit);

      return ResponseUtils.success(res, barbers, 'Busca realizada com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao buscar barbeiros:', error);
      return ResponseUtils.error(res, 'Erro interno ao buscar barbeiros');
    }
  };

  // =====================================================
  // 📊 BARBEIROS DISPONÍVEIS (PÚBLICO)
  // =====================================================

  getAvailableBarbers = async (req, res) => {
    try {
      // Validar parâmetros
      const validation = BarberSchemas.availableBarbers.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Buscar barbeiros disponíveis
      const barbers = await this.barberService.getAvailableBarbers(params);

      return ResponseUtils.success(res, barbers, 'Barbeiros disponíveis encontrados');
    } catch (error) {
      console.error('[BarberController] Erro ao buscar barbeiros disponíveis:', error);
      return ResponseUtils.error(res, 'Erro interno ao buscar barbeiros disponíveis');
    }
  };

  // =====================================================
  // 📊 PERFORMANCE DO BARBEIRO (APENAS ADMIN)
  // =====================================================

  getBarberPerformance = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem acessar relatórios de performance');
      }

      // Validar parâmetros
      const validation = BarberSchemas.barberPerformance.safeParse(req.query);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const params = validation.data;

      // Obter performance
      const performance = await this.barberService.getBarberPerformance(params);

      return ResponseUtils.success(res, performance, 'Relatório de performance gerado com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao gerar relatório de performance:', error);
      return ResponseUtils.error(res, 'Erro interno ao gerar relatório de performance');
    }
  };

  // =====================================================
  // 🏷️ ADICIONAR ESPECIALIDADE (APENAS ADMIN)
  // =====================================================

  addSpecialty = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem gerenciar especialidades');
      }

      // Validar ID
      const idValidation = BarberSchemas.barberId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Validar especialidade
      const validation = BarberSchemas.addSpecialty.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const { specialty } = validation.data;

      // Adicionar especialidade
      const barber = await this.barberService.addSpecialty(id, specialty, req.user.id);

      return ResponseUtils.success(res, barber, 'Especialidade adicionada com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao adicionar especialidade:', error);

      if (error.code === 'BARBER_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Barbeiro não encontrado');
      }

      if (error.code === 'SPECIALTY_EXISTS') {
        return ResponseUtils.badRequest(res, 'Barbeiro já possui esta especialidade');
      }

      if (error.code === 'MAX_SPECIALTIES') {
        return ResponseUtils.badRequest(res, 'Barbeiro já possui o máximo de especialidades permitidas (10)');
      }

      return ResponseUtils.error(res, 'Erro interno ao adicionar especialidade');
    }
  };

  // =====================================================
  // 🗑️ REMOVER ESPECIALIDADE (APENAS ADMIN)
  // =====================================================

  removeSpecialty = async (req, res) => {
    try {
      // Verificar se é admin
      if (req.user.role !== 'admin') {
        return ResponseUtils.forbidden(res, 'Apenas administradores podem gerenciar especialidades');
      }

      // Validar ID
      const idValidation = BarberSchemas.barberId.safeParse(req.params);
      if (!idValidation.success) {
        return ValidationMiddleware.handleValidationError(res, idValidation.error);
      }

      const { id } = idValidation.data;

      // Validar especialidade
      const validation = BarberSchemas.removeSpecialty.safeParse(req.body);
      if (!validation.success) {
        return ValidationMiddleware.handleValidationError(res, validation.error);
      }

      const { specialty } = validation.data;

      // Remover especialidade
      const barber = await this.barberService.removeSpecialty(id, specialty, req.user.id);

      return ResponseUtils.success(res, barber, 'Especialidade removida com sucesso');
    } catch (error) {
      console.error('[BarberController] Erro ao remover especialidade:', error);

      if (error.code === 'BARBER_NOT_FOUND') {
        return ResponseUtils.notFound(res, 'Barbeiro não encontrado');
      }

      if (error.code === 'SPECIALTY_NOT_FOUND') {
        return ResponseUtils.badRequest(res, 'Barbeiro não possui esta especialidade');
      }

      return ResponseUtils.error(res, 'Erro interno ao remover especialidade');
    }
  };
}

module.exports = { BarberController };