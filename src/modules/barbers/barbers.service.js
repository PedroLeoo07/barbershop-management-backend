const { BarberRepository } = require('./barbers.repository');
const { UserRepository } = require('../users/users.repository');
const { AppError } = require('../../shared/errors/AppError');

// =====================================================
// SERVICE DE BARBEIROS
// =====================================================

class BarberService {
  constructor() {
    this.barberRepository = new BarberRepository();
    this.userRepository = new UserRepository();
  }

  // =====================================================
  // 🔧 CRIAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  async createBarber(requestingUser, barberData) {
    try {
      // Verificar se é admin
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem criar barbeiros');
      }

      // Validar dados
      await this.validateBarberData(barberData);

      // Preparar dados para criação
      const barberToCreate = {
        name: barberData.name.trim(),
        description: barberData.description?.trim() || null,
        user_id: barberData.user_id || null,
        experience_years: barberData.experience_years || 0,
        specialties: barberData.specialties || [],
        avatar_url: barberData.avatar_url || null,
        is_active: barberData.is_active !== false // default true
      };

      const barber = await this.barberRepository.createBarber(barberToCreate);

      console.log(`🎉 New barber created: ${barber.name} by admin ${requestingUser.email}`);

      return barber;

    } catch (error) {
      console.error('❌ Barber creation failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 📋 LISTAR BARBEIROS
  // =====================================================

  async listBarbers(filters = {}, pagination = { page: 1, limit: 10 }) {
    try {
      const offset = (pagination.page - 1) * pagination.limit;

      const barbers = await this.barberRepository.findAllBarbers(filters, {
        limit: pagination.limit,
        offset
      });

      const total = await this.barberRepository.countBarbers(filters);

      return {
        barbers,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
          hasNext: pagination.page < Math.ceil(total / pagination.limit),
          hasPrev: pagination.page > 1
        }
      };

    } catch (error) {
      console.error('❌ Failed to list barbers:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCAR BARBEIRO POR ID
  // =====================================================

  async getBarberById(id) {
    const barber = await this.barberRepository.findById(id);

    if (!barber) {
      throw AppError.barberNotFound();
    }

    return barber;
  }

  async getActiveBarberById(id) {
    const barber = await this.barberRepository.findActiveById(id);

    if (!barber) {
      throw AppError.barberNotFound('Barbeiro não encontrado ou inativo');
    }

    return barber;
  }

  // =====================================================
  // 📊 BUSCAR BARBEIROS DISPONÍVEIS
  // =====================================================

  async getAvailableBarbers(date = null, time = null, duration = null) {
    try {
      const barbers = await this.barberRepository.findAvailableBarbers(date, time, duration);

      // Se especificou horário, ordenar por disponibilidade
      if (date && time && duration) {
        return barbers.map(barber => ({
          ...barber,
          availability: 'available' // Todos os retornados estão disponíveis
        }));
      }

      return barbers;

    } catch (error) {
      console.error('❌ Failed to get available barbers:', error.message);
      throw error;
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  async updateBarber(requestingUser, id, updateData) {
    try {
      // Verificar se é admin
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem atualizar barbeiros');
      }

      // Verificar se barbeiro existe
      const existingBarber = await this.barberRepository.findById(id);
      if (!existingBarber) {
        throw AppError.barberNotFound();
      }

      // Validar dados de atualização
      await this.validateUpdateData(updateData);

      // Campos permitidos para atualização
      const allowedFields = ['name', 'description', 'experience_years', 'specialties', 'avatar_url', 'is_active', 'user_id'];
      const sanitizedData = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          sanitizedData[field] = updateData[field];
        }
      }

      if (Object.keys(sanitizedData).length === 0) {
        throw AppError.badRequest('Nenhum campo válido para atualização');
      }

      const updatedBarber = await this.barberRepository.updateBarber(id, sanitizedData);

      console.log(`✅ Barber updated: ${updatedBarber.name} by admin ${requestingUser.email}`);

      return updatedBarber;

    } catch (error) {
      console.error('❌ Barber update failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🗑️ DESATIVAR/REATIVAR BARBEIRO (APENAS ADMIN)
  // =====================================================

  async deactivateBarber(requestingUser, id) {
    try {
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem desativar barbeiros');
      }

      const barber = await this.barberRepository.deactivateBarber(id);

      console.log(`🗑️ Barber deactivated: ${barber.name} by admin ${requestingUser.email}`);

      return barber;

    } catch (error) {
      console.error('❌ Barber deactivation failed:', error.message);
      throw error;
    }
  }

  async reactivateBarber(requestingUser, id) {
    try {
      if (requestingUser.role !== 'ADMIN') {
        throw AppError.forbidden('Apenas administradores podem reativar barbeiros');
      }

      const barber = await this.barberRepository.reactivateBarber(id);

      console.log(`✅ Barber reactivated: ${barber.name} by admin ${requestingUser.email}`);

      return barber;

    } catch (error) {
      console.error('❌ Barber reactivation failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCA DE BARBEIROS
  // =====================================================

  async searchBarbers(searchTerm, limit = 20) {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw AppError.badRequest('Termo de busca deve ter pelo menos 2 caracteres');
      }

      return await this.barberRepository.searchBarbers(searchTerm.trim(), limit);

    } catch (error) {
      console.error('❌ Barber search failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 📊 ESTATÍSTICAS E PERFORMANCE
  // =====================================================

  async getBarberStats(requestingUser) {
    if (requestingUser.role !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem ver estatísticas');
    }

    const stats = await this.barberRepository.getBarberStats();
    const specialties = await this.barberRepository.getSpecialtiesList();

    return {
      ...stats,
      total_specialties: specialties.length,
      available_specialties: specialties
    };
  }

  async getBarberPerformance(requestingUser, barberId = null, startDate = null, endDate = null) {
    if (requestingUser.role !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem ver performance');
    }

    // Validar datas se fornecidas
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        throw AppError.badRequest('Data inicial deve ser menor que data final');
      }
    }

    return await this.barberRepository.getBarberPerformance(barberId, startDate, endDate);
  }

  // =====================================================
  // 📋 ESPECIALIDADES
  // =====================================================

  async getSpecialties() {
    try {
      return await this.barberRepository.getSpecialtiesList();
    } catch (error) {
      console.error('❌ Failed to get specialties:', error.message);
      throw error;
    }
  }

  // =====================================================
  // ✅ VALIDAÇÕES
  // =====================================================

  async validateBarberData(barberData) {
    if (!barberData.name || barberData.name.trim().length < 2) {
      throw AppError.requiredField('Nome deve ter pelo menos 2 caracteres');
    }

    if (barberData.name.length > 100) {
      throw AppError.invalidFormat('name', 'nome com no máximo 100 caracteres');
    }

    if (barberData.description && barberData.description.length > 500) {
      throw AppError.invalidFormat('description', 'descrição com no máximo 500 caracteres');
    }

    if (barberData.experience_years && (barberData.experience_years < 0 || barberData.experience_years > 50)) {
      throw AppError.invalidFormat('experience_years', 'experiência entre 0 e 50 anos');
    }

    if (barberData.specialties && !Array.isArray(barberData.specialties)) {
      throw AppError.invalidFormat('specialties', 'array de especialidades');
    }

    if (barberData.specialties && barberData.specialties.length > 10) {
      throw AppError.invalidFormat('specialties', 'no máximo 10 especialidades');
    }

    if (barberData.avatar_url && !this.isValidUrl(barberData.avatar_url)) {
      throw AppError.invalidFormat('avatar_url', 'URL válida');
    }

    // Validar user_id se fornecido
    if (barberData.user_id) {
      const userExists = await this.userRepository.userExistsAndActive(barberData.user_id);
      if (!userExists) {
        throw AppError.badRequest('Usuário não encontrado ou inativo');
      }

      const isAdmin = await this.userRepository.isUserAdmin(barberData.user_id);
      if (!isAdmin) {
        throw AppError.badRequest('Usuário deve ter role ADMIN para ser vinculado a barbeiro');
      }
    }
  }

  async validateUpdateData(updateData) {
    if (updateData.name && (updateData.name.trim().length < 2 || updateData.name.length > 100)) {
      throw AppError.invalidFormat('name', 'nome entre 2 e 100 caracteres');
    }

    if (updateData.description && updateData.description.length > 500) {
      throw AppError.invalidFormat('description', 'descrição com no máximo 500 caracteres');
    }

    if (updateData.experience_years && (updateData.experience_years < 0 || updateData.experience_years > 50)) {
      throw AppError.invalidFormat('experience_years', 'experiência entre 0 e 50 anos');
    }

    if (updateData.specialties && !Array.isArray(updateData.specialties)) {
      throw AppError.invalidFormat('specialties', 'array de especialidades');
    }

    if (updateData.specialties && updateData.specialties.length > 10) {
      throw AppError.invalidFormat('specialties', 'no máximo 10 especialidades');
    }

    if (updateData.avatar_url && !this.isValidUrl(updateData.avatar_url)) {
      throw AppError.invalidFormat('avatar_url', 'URL válida');
    }

    if (updateData.user_id) {
      const userExists = await this.userRepository.userExistsAndActive(updateData.user_id);
      if (!userExists) {
        throw AppError.badRequest('Usuário não encontrado ou inativo');
      }

      const isAdmin = await this.userRepository.isUserAdmin(updateData.user_id);
      if (!isAdmin) {
        throw AppError.badRequest('Usuário deve ter role ADMIN para ser vinculado a barbeiro');
      }
    }
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { BarberService };