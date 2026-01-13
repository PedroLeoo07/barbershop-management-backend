const { ServiceRepository } = require('./services.repository');

// =====================================================
// SERVICE PARA SERVIÇOS DA BARBEARIA (APENAS ADMIN)
// =====================================================

class ServiceService {
  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  // =====================================================
  // ➕ CRIAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  async createService(serviceData, adminUserId) {
    try {
      console.log(`[ServiceService] Admin ${adminUserId} criando serviço: ${serviceData.name}`);

      // Validações de negócio
      this._validateServiceData(serviceData);

      // Criar serviço
      const service = await this.serviceRepository.createService(serviceData, adminUserId);

      return {
        ...service,
        message: 'Serviço criado com sucesso'
      };

    } catch (error) {
      console.error('[ServiceService] Erro ao criar serviço:', error);
      throw error;
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR SERVIÇO (APENAS ADMIN)
  // =====================================================

  async updateService(serviceId, updateData, adminUserId) {
    try {
      console.log(`[ServiceService] Admin ${adminUserId} atualizando serviço: ${serviceId}`);

      // Validações de negócio se houver mudanças de preço/duração
      if (updateData.price_min !== undefined || updateData.price_max !== undefined ||
          updateData.duration_min !== undefined || updateData.duration_max !== undefined) {
        this._validateServiceData({ ...updateData });
      }

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