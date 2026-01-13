const { ServiceRepository } = require('./services.repository');
const { AppError } = require('../../utils/AppError');

// =====================================================
// SERVIÇO PARA GERENCIAMENTO DE SERVIÇOS - NOVA ESTRUTURA
// =====================================================

class ServiceService {
  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  // =====================================================
  // 📝 CRIAR NOVO SERVIÇO
  // =====================================================

  async createService(serviceData) {
    try {
      // Verificar se já existe um serviço com o mesmo nome
      const existingService = await this.serviceRepository.findByName(serviceData.name);
      if (existingService) {
        const error = new AppError('Já existe um serviço com este nome', 409);
        error.code = 'SERVICE_NAME_EXISTS';
        throw error;
      }

      // Validações de negócio
      if (serviceData.duration_minutes < 1 || serviceData.duration_minutes > 480) {
        const error = new AppError('Duração deve estar entre 1 e 480 minutos', 400);
        error.code = 'INVALID_DURATION';
        throw error;
      }

      if (serviceData.price <= 0) {
        const error = new AppError('Preço deve ser positivo', 400);
        error.code = 'INVALID_PRICE';
        throw error;
      }

      // Criar serviço
      const service = await this.serviceRepository.createService(serviceData);
      
      return service;
    } catch (error) {
      console.error('[ServiceService] Erro ao criar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR SERVIÇO
  // =====================================================

  async updateService(serviceId, updateData) {
    try {
      // Verificar se o serviço existe
      const existingService = await this.serviceRepository.findById(serviceId);
      if (!existingService) {
        const error = new AppError('Serviço não encontrado', 404);
        error.code = 'SERVICE_NOT_FOUND';
        throw error;
      }

      // Verificar se o nome não está sendo usado por outro serviço
      if (updateData.name && updateData.name !== existingService.name) {
        const nameExists = await this.serviceRepository.findByName(updateData.name);
        if (nameExists && nameExists.id !== serviceId) {
          const error = new AppError('Já existe um serviço com este nome', 409);
          error.code = 'SERVICE_NAME_EXISTS';
          throw error;
        }
      }

      // Validações de negócio
      if (updateData.duration_minutes && (updateData.duration_minutes < 1 || updateData.duration_minutes > 480)) {
        const error = new AppError('Duração deve estar entre 1 e 480 minutos', 400);
        error.code = 'INVALID_DURATION';
        throw error;
      }

      if (updateData.price && updateData.price <= 0) {
        const error = new AppError('Preço deve ser positivo', 400);
        error.code = 'INVALID_PRICE';
        throw error;
      }

      // Atualizar serviço
      const updatedService = await this.serviceRepository.updateService(serviceId, updateData);
      
      return updatedService;
    } catch (error) {
      console.error('[ServiceService] Erro ao atualizar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 🗑️ DELETAR SERVIÇO
  // =====================================================

  async deleteService(serviceId) {
    try {
      // Verificar se o serviço existe
      const existingService = await this.serviceRepository.findById(serviceId);
      if (!existingService) {
        const error = new AppError('Serviço não encontrado', 404);
        error.code = 'SERVICE_NOT_FOUND';
        throw error;
      }

      // Verificar se há agendamentos futuros com este serviço
      const hasFutureAppointments = await this.serviceRepository.hasFutureAppointments(serviceId);
      if (hasFutureAppointments) {
        const error = new AppError('Não é possível remover serviço com agendamentos futuros', 400);
        error.code = 'SERVICE_HAS_FUTURE_APPOINTMENTS';
        throw error;
      }

      // Deletar serviço
      await this.serviceRepository.deleteService(serviceId);
      
      return true;
    } catch (error) {
      console.error('[ServiceService] Erro ao deletar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 📋 LISTAR SERVIÇOS COM FILTROS E PAGINAÇÃO
  // =====================================================

  async listServices(params) {
    try {
      const result = await this.serviceRepository.findWithFilters(params);
      
      return result;
    } catch (error) {
      console.error('[ServiceService] Erro ao listar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇO POR ID
  // =====================================================

  async getServiceById(serviceId) {
    try {
      const service = await this.serviceRepository.findById(serviceId);
      
      if (!service) {
        const error = new AppError('Serviço não encontrado', 404);
        error.code = 'SERVICE_NOT_FOUND';
        throw error;
      }
      
      return service;
    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇOS POR TEXTO
  // =====================================================

  async searchServices(searchTerm, limit = 20) {
    try {
      const services = await this.serviceRepository.searchByName(searchTerm, limit);
      
      return services;
    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 SERVIÇOS POPULARES
  // =====================================================

  async getPopularServices(limit = 10, days = 30) {
    try {
      const services = await this.serviceRepository.findPopular(limit, days);
      
      return services;
    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços populares:', error);
      throw error;
    }
  }

  // =====================================================
  // 🎯 SERVIÇOS ATIVOS
  // =====================================================

  async getActiveServices() {
    try {
      const services = await this.serviceRepository.findActive();
      
      return services;
    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços ativos:', error);
      throw error;
    }
  }

  // =====================================================
  // ⏰ CALCULAR DURAÇÃO TOTAL DE SERVIÇOS
  // =====================================================

  async getTotalDuration(serviceIds) {
    try {
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        throw new AppError('Lista de IDs de serviços é obrigatória', 400);
      }

      const totalDuration = await this.serviceRepository.getTotalDuration(serviceIds);
      
      return totalDuration;
    } catch (error) {
      console.error('[ServiceService] Erro ao calcular duração total:', error);
      throw error;
    }
  }

  // =====================================================
  // 💰 CALCULAR PREÇO TOTAL DE SERVIÇOS
  // =====================================================

  async getTotalPrice(serviceIds) {
    try {
      if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
        throw new AppError('Lista de IDs de serviços é obrigatória', 400);
      }

      const totalPrice = await this.serviceRepository.getTotalPrice(serviceIds);
      
      return totalPrice;
    } catch (error) {
      console.error('[ServiceService] Erro ao calcular preço total:', error);
      throw error;
    }
  }

  // =====================================================
  // 📱 ALTERNAR STATUS DO SERVIÇO
  // =====================================================

  async toggleServiceStatus(serviceId) {
    try {
      // Verificar se o serviço existe
      const existingService = await this.serviceRepository.findById(serviceId);
      if (!existingService) {
        const error = new AppError('Serviço não encontrado', 404);
        error.code = 'SERVICE_NOT_FOUND';
        throw error;
      }

      // Alternar status
      const newStatus = !existingService.active;
      const updatedService = await this.serviceRepository.updateService(serviceId, { active: newStatus });
      
      return updatedService;
    } catch (error) {
      console.error('[ServiceService] Erro ao alternar status:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 ESTATÍSTICAS DOS SERVIÇOS
  // =====================================================

  async getServiceStats() {
    try {
      const stats = await this.serviceRepository.getStats();
      
      return stats;
    } catch (error) {
      console.error('[ServiceService] Erro ao obter estatísticas:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔄 SERVIÇOS SIMILARES (por preço/duração)
  // =====================================================

  async getSimilarServices(serviceId, limit = 5) {
    try {
      // Verificar se o serviço existe
      const service = await this.serviceRepository.findById(serviceId);
      if (!service) {
        const error = new AppError('Serviço não encontrado', 404);
        error.code = 'SERVICE_NOT_FOUND';
        throw error;
      }

      // Buscar serviços similares
      const similarServices = await this.serviceRepository.findSimilar(serviceId, limit);
      
      return similarServices;
    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços similares:', error);
      throw error;
    }
  }

  // =====================================================
  // 🎲 VALIDAÇÕES AUXILIARES
  // =====================================================

  validateServiceData(data) {
    const errors = [];

    if (data.name && data.name.length < 2) {
      errors.push('Nome deve ter pelo menos 2 caracteres');
    }

    if (data.duration_minutes && (data.duration_minutes < 1 || data.duration_minutes > 480)) {
      errors.push('Duração deve estar entre 1 e 480 minutos');
    }

    if (data.price && data.price <= 0) {
      errors.push('Preço deve ser positivo');
    }

    return errors;
  }
}

module.exports = { ServiceService };

      // Atualizar serviço
      const service = await this.serviceRepository.updateService(serviceId, updateData, adminUserId);

      return {
        ...service,
        message: 'Serviço atualizado com sucesso'
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao atualizar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 🗑️ DELETAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  async deleteService(serviceId, adminUserId) {
    try {
      console.log(`[ServiceService] Admin ${adminUserId} removendo serviço: ${serviceId}`);

      // Remover serviço
      await this.serviceRepository.deleteService(serviceId, adminUserId);

      return {
        message: 'Serviço removido com sucesso'
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao deletar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇO POR ID (PÚBLICO)
  // =====================================================

  async getServiceById(serviceId) {
    try {
      const service = await this.serviceRepository.findById(serviceId);

      // Calcular informações extras
      const enrichedService = this._enrichServiceData(service);

      return enrichedService;

    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // 📋 LISTAR SERVIÇOS (PÚBLICO)
  // =====================================================

  async listServices(filters = {}) {
    try {
      console.log('[ServiceService] Listando serviços com filtros:', filters);

      const result = await this.serviceRepository.listServices(filters);

      // Enriquecer dados dos serviços
      const enrichedServices = result.services.map(service => this._enrichServiceData(service));

      return {
        services: enrichedServices,
        pagination: result.pagination,
        filters: filters
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao listar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR SERVIÇOS (PÚBLICO)
  // =====================================================

  async searchServices(searchTerm, limit = 20) {
    try {
      console.log(`[ServiceService] Buscando serviços: "${searchTerm}"`);

      const services = await this.serviceRepository.searchServices(searchTerm, limit);

      // Enriquecer dados dos serviços
      const enrichedServices = services.map(service => this._enrichServiceData(service));

      return {
        services: enrichedServices,
        searchTerm,
        count: services.length
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 SERVIÇOS POPULARES (PÚBLICO)
  // =====================================================

  async getPopularServices(limit = 10, days = 30) {
    try {
      console.log(`[ServiceService] Buscando serviços populares dos últimos ${days} dias`);

      const services = await this.serviceRepository.getPopularServices(limit, days);

      // Enriquecer dados
      const enrichedServices = services.map(service => ({
        ...this._enrichServiceData(service),
        stats: {
          appointmentCount: parseInt(service.appointment_count) || 0,
          totalRevenue: parseFloat(service.total_revenue) || 0
        }
      }));

      return {
        services: enrichedServices,
        period: {
          days,
          limit
        }
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao buscar serviços populares:', error);
      throw error;
    }
  }

  // =====================================================
  // 📊 RELATÓRIO DE RECEITA (APENAS ADMIN)
  // =====================================================

  async getServiceRevenue(filters = {}) {
    try {
      console.log('[ServiceService] Gerando relatório de receita:', filters);

      const revenue = await this.serviceRepository.getServiceRevenue(filters);

      // Calcular totais
      const summary = {
        totalServices: revenue.length,
        totalAppointments: revenue.reduce((sum, item) => sum + parseInt(item.appointment_count), 0),
        totalRevenue: revenue.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0),
        avgRevenuePerService: revenue.length > 0 ? 
          revenue.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0) / revenue.length : 0
      };

      return {
        revenue: revenue.map(item => ({
          ...item,
          appointment_count: parseInt(item.appointment_count),
          total_revenue: parseFloat(item.total_revenue),
          avg_price: parseFloat(item.avg_price),
          min_price: parseFloat(item.min_price),
          max_price: parseFloat(item.max_price)
        })),
        summary,
        filters,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao gerar relatório de receita:', error);
      throw error;
    }
  }

  // =====================================================
  // 📂 CATEGORIAS (PÚBLICO)
  // =====================================================

  async getCategories() {
    try {
      console.log('[ServiceService] Buscando categorias de serviços');

      const categories = await this.serviceRepository.getCategories();

      return {
        categories: categories.map(category => ({
          name: category.category,
          serviceCount: parseInt(category.service_count),
          priceRange: {
            min: parseFloat(category.avg_price_min) || 0,
            max: parseFloat(category.avg_price_max) || 0
          },
          durationRange: {
            min: parseInt(category.min_duration) || 0,
            max: parseInt(category.max_duration) || 0
          }
        })),
        totalCategories: categories.length
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao buscar categorias:', error);
      throw error;
    }
  }

  // =====================================================
  // 🔧 VALIDAÇÕES PRIVADAS
  // =====================================================

  _validateServiceData(serviceData) {
    // Validar preços
    if (serviceData.price_min !== undefined && serviceData.price_max !== undefined) {
      if (serviceData.price_max < serviceData.price_min) {
        throw {
          code: 'INVALID_PRICE_RANGE',
          message: 'Preço máximo deve ser maior ou igual ao preço mínimo'
        };
      }
    }

    // Validar durações
    if (serviceData.duration_min !== undefined && serviceData.duration_max !== undefined) {
      if (serviceData.duration_max < serviceData.duration_min) {
        throw {
          code: 'INVALID_DURATION_RANGE',
          message: 'Duração máxima deve ser maior ou igual à duração mínima'
        };
      }
    }

    // Validar valores mínimos
    if (serviceData.price_min !== undefined && serviceData.price_min <= 0) {
      throw {
        code: 'INVALID_PRICE',
        message: 'Preço deve ser maior que zero'
      };
    }

    if (serviceData.duration_min !== undefined && serviceData.duration_min < 15) {
      throw {
        code: 'INVALID_DURATION',
        message: 'Duração mínima deve ser de pelo menos 15 minutos'
      };
    }

    // Validar categorias permitidas
    const validCategories = [
      'corte', 'barba', 'sobrancelha', 'tratamento', 'combo', 'especial', 'geral'
    ];

    if (serviceData.category && !validCategories.includes(serviceData.category)) {
      throw {
        code: 'INVALID_CATEGORY',
        message: `Categoria deve ser uma das seguintes: ${validCategories.join(', ')}`
      };
    }
  }

  // =====================================================
  // 🎨 ENRIQUECER DADOS DO SERVIÇO
  // =====================================================

  _enrichServiceData(service) {
    const enriched = {
      ...service,
      // Converter preços para números
      price_min: parseFloat(service.price_min),
      price_max: parseFloat(service.price_max),
      
      // Adicionar informações calculadas
      priceRange: {
        min: parseFloat(service.price_min),
        max: parseFloat(service.price_max),
        hasRange: parseFloat(service.price_max) > parseFloat(service.price_min)
      },
      
      durationRange: {
        min: parseInt(service.duration_min),
        max: parseInt(service.duration_max),
        hasRange: parseInt(service.duration_max) > parseInt(service.duration_min)
      },

      // Informações de display
      displayPrice: this._formatPriceDisplay(service.price_min, service.price_max),
      displayDuration: this._formatDurationDisplay(service.duration_min, service.duration_max),

      // Flags úteis
      isVariable: parseFloat(service.price_max) > parseFloat(service.price_min) || 
                  parseInt(service.duration_max) > parseInt(service.duration_min)
    };

    return enriched;
  }

  // =====================================================
  // 🎨 FORMATAÇÃO DE EXIBIÇÃO
  // =====================================================

  _formatPriceDisplay(priceMin, priceMax) {
    const min = parseFloat(priceMin);
    const max = parseFloat(priceMax);

    if (max > min) {
      return `R$ ${min.toFixed(2).replace('.', ',')} - R$ ${max.toFixed(2).replace('.', ',')}`;
    }
    return `R$ ${min.toFixed(2).replace('.', ',')}`;
  }

  _formatDurationDisplay(durationMin, durationMax) {
    const min = parseInt(durationMin);
    const max = parseInt(durationMax);

    const formatDuration = (minutes) => {
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
          return `${hours}h`;
        }
        return `${hours}h${remainingMinutes}min`;
      }
      return `${minutes}min`;
    };

    if (max > min) {
      return `${formatDuration(min)} - ${formatDuration(max)}`;
    }
    return formatDuration(min);
  }
}

module.exports = { ServiceService };