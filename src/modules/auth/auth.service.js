const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserRepository } = require('./users.repository');
const { AppError } = require('../../shared/errors/AppError');

// =====================================================
// SERVICE DE AUTENTICAÇÃO E USUÁRIOS
// =====================================================

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  // =====================================================
  // 🔐 REGISTRO DE USUÁRIOS
  // =====================================================

  async register(userData) {
    try {
      // Validar dados básicos
      await this.validateUserData(userData);

      // Verificar se email já existe
      const emailExists = await this.userRepository.emailExists(userData.email);
      if (emailExists) {
        throw AppError.duplicateEntry('email', userData.email);
      }

      // Hash da senha
      const saltRounds = 12; // Segurança alta
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);

      // Preparar dados para criação
      const userToCreate = {
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: userData.role || 'CLIENT', // Default: CLIENT
        phone: userData.phone?.replace(/\D/g, '') || null // Limpar phone
      };

      // Criar usuário
      const user = await this.userRepository.createUser(userToCreate);

      console.log(`🎉 New user registered: ${user.email} (${user.role})`);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        created_at: user.created_at
      };

    } catch (error) {
      console.error('❌ Registration failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🔑 LOGIN DE USUÁRIOS
  // =====================================================

  async login(email, password) {
    try {
      // Buscar usuário por email (com senha)
      const user = await this.userRepository.findByEmailWithPassword(email.toLowerCase().trim());

      if (!user) {
        throw AppError.invalidCredentials('Email ou senha inválidos');
      }

      if (!user.is_active) {
        throw AppError.forbidden('Conta desativada. Contate o administrador.');
      }

      // Verificar senha
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        throw AppError.invalidCredentials('Email ou senha inválidos');
      }

      // Gerar tokens
      const tokens = this.generateTokens(user);

      console.log(`🔑 User logged in: ${user.email} (${user.role})`);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        ...tokens
      };

    } catch (error) {
      console.error('❌ Login failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🎫 GERAÇÃO DE TOKENS JWT
  // =====================================================

  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    // Access Token (24h)
    const accessToken = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'barbearia-api',
        audience: 'barbearia-client'
      }
    );

    // Refresh Token (7 dias) - opcional para futuro
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: 'barbearia-api',
        audience: 'barbearia-refresh'
      }
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    };
  }

  // =====================================================
  // 🔍 VALIDAR TOKEN JWT
  // =====================================================

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'barbearia-api',
        audience: 'barbearia-client'
      });

      // Verificar se usuário ainda existe e está ativo
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user) {
        throw AppError.unauthorized('Usuário não encontrado');
      }

      return {
        user,
        decoded
      };

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw AppError.unauthorized('Token inválido');
      }
      if (error.name === 'TokenExpiredError') {
        throw AppError.tokenExpired('Token expirado');
      }
      throw error;
    }
  }

  // =====================================================
  // 🔄 REFRESH TOKEN
  // =====================================================

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        issuer: 'barbearia-api',
        audience: 'barbearia-refresh'
      });

      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user) {
        throw AppError.unauthorized('Usuário não encontrado');
      }

      // Gerar novos tokens
      const tokens = this.generateTokens(user);

      console.log(`🔄 Token refreshed for user: ${user.email}`);

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        ...tokens
      };

    } catch (error) {
      throw AppError.unauthorized('Refresh token inválido');
    }
  }

  // =====================================================
  // ✏️ ATUALIZAR PERFIL
  // =====================================================

  async updateProfile(userId, updateData) {
    try {
      // Verificar se usuário existe
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw AppError.userNotFound();
      }

      // Campos permitidos para atualização
      const allowedFields = ['name', 'phone'];
      const sanitizedData = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          sanitizedData[field] = field === 'phone' 
            ? updateData[field]?.replace(/\D/g, '') || null
            : updateData[field].trim();
        }
      }

      if (Object.keys(sanitizedData).length === 0) {
        throw AppError.badRequest('Nenhum campo válido para atualização');
      }

      const updatedUser = await this.userRepository.updateUser(userId, sanitizedData);

      console.log(`✅ Profile updated for user: ${updatedUser.email}`);

      return updatedUser;

    } catch (error) {
      console.error('❌ Profile update failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 🔐 ALTERAR SENHA
  // =====================================================

  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Buscar usuário com senha atual
      const user = await this.userRepository.findByIdWithRole(userId);
      if (!user) {
        throw AppError.userNotFound();
      }

      // Buscar hash da senha atual
      const userWithPassword = await this.userRepository.findByEmailWithPassword(user.email);
      
      // Verificar senha atual
      const currentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.password_hash);
      if (!currentPasswordValid) {
        throw AppError.badRequest('Senha atual incorreta');
      }

      // Validar nova senha
      this.validatePassword(newPassword);

      // Hash da nova senha
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Atualizar senha
      await this.userRepository.updatePassword(userId, newPasswordHash);

      console.log(`🔐 Password changed for user: ${user.email}`);

      return { message: 'Senha alterada com sucesso' };

    } catch (error) {
      console.error('❌ Password change failed:', error.message);
      throw error;
    }
  }

  // =====================================================
  // 👤 BUSCAR PERFIL DO USUÁRIO
  // =====================================================

  async getProfile(userId) {
    const user = await this.userRepository.findById(userId);
    
    if (!user) {
      throw AppError.userNotFound();
    }

    return user;
  }

  // =====================================================
  // 📊 LISTAR USUÁRIOS (APENAS ADMIN)
  // =====================================================

  async listUsers(requestingUser, filters = {}, pagination = { page: 1, limit: 10 }) {
    // Verificar se é admin
    if (requestingUser.role !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem listar usuários');
    }

    const offset = (pagination.page - 1) * pagination.limit;
    
    const users = await this.userRepository.findAllUsers(filters, {
      limit: pagination.limit,
      offset
    });

    const total = await this.userRepository.countUsers(filters);

    return {
      users,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
        hasNext: pagination.page < Math.ceil(total / pagination.limit),
        hasPrev: pagination.page > 1
      }
    };
  }

  // =====================================================
  // 🗑️ GERENCIAR USUÁRIOS (APENAS ADMIN)
  // =====================================================

  async deactivateUser(requestingUser, targetUserId) {
    if (requestingUser.role !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem desativar usuários');
    }

    if (requestingUser.id === targetUserId) {
      throw AppError.badRequest('Não é possível desativar sua própria conta');
    }

    return await this.userRepository.deactivateUser(targetUserId);
  }

  async reactivateUser(requestingUser, targetUserId) {
    if (requestingUser.role !== 'ADMIN') {
      throw AppError.forbidden('Apenas administradores podem reativar usuários');
    }

    return await this.userRepository.reactivateUser(targetUserId);
  }

  // =====================================================
  // ✅ VALIDAÇÕES
  // =====================================================

  async validateUserData(userData) {
    if (!userData.name || userData.name.trim().length < 2) {
      throw AppError.requiredField('Nome deve ter pelo menos 2 caracteres');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      throw AppError.invalidFormat('email', 'email válido (ex: usuario@dominio.com)');
    }

    if (!userData.password) {
      throw AppError.requiredField('password');
    }

    this.validatePassword(userData.password);

    if (userData.role && !['CLIENT', 'ADMIN'].includes(userData.role)) {
      throw AppError.invalidFormat('role', 'CLIENT ou ADMIN');
    }

    if (userData.phone && !this.isValidPhone(userData.phone)) {
      throw AppError.invalidFormat('phone', 'telefone válido (apenas números)');
    }
  }

  validatePassword(password) {
    if (!password || password.length < 6) {
      throw AppError.invalidFormat('password', 'senha com pelo menos 6 caracteres');
    }

    // Opcional: validações mais rigorosas
    if (password.length > 128) {
      throw AppError.invalidFormat('password', 'senha com no máximo 128 caracteres');
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 15;
  }
}

module.exports = { AuthService };