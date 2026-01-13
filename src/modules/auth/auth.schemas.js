const { z } = require('zod');

// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA AUTENTICAÇÃO E USUÁRIOS
// =====================================================

class AuthSchemas {
  // =====================================================
  // 📝 SCHEMA PARA REGISTRO DE USUÁRIOS
  // =====================================================

  static get register() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços'),

      email: z.string()
        .email('Email deve ser um endereço válido')
        .max(255, 'Email deve ter no máximo 255 caracteres')
        .toLowerCase()
        .trim(),

      password: z.string()
        .min(6, 'Senha deve ter pelo menos 6 caracteres')
        .max(128, 'Senha deve ter no máximo 128 caracteres'),
        // .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter ao menos 1 minúscula, 1 maiúscula e 1 número'), // Opcional: senha forte

      confirmPassword: z.string()
        .optional(),

      phone: z.string()
        .regex(/^\d{10,15}$/, 'Telefone deve conter entre 10 e 15 dígitos')
        .optional()
        .transform(phone => phone?.replace(/\D/g, '') || null),

      role: z.enum(['CLIENT', 'ADMIN'], 'Role deve ser CLIENT ou ADMIN')
        .optional()
        .default('CLIENT')
    }).refine(data => {
      // Validar confirmação de senha se fornecida
      if (data.confirmPassword && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    }, {
      message: 'Senhas não coincidem',
      path: ['confirmPassword']
    });
  }

  // =====================================================
  // 🔑 SCHEMA PARA LOGIN
  // =====================================================

  static get login() {
    return z.object({
      email: z.string()
        .email('Email inválido')
        .toLowerCase()
        .trim(),

      password: z.string()
        .min(1, 'Senha é obrigatória')
    });
  }

  // =====================================================
  // 🔄 SCHEMA PARA REFRESH TOKEN
  // =====================================================

  static get refreshToken() {
    return z.object({
      refreshToken: z.string()
        .min(1, 'Refresh token é obrigatório')
    });
  }

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE PERFIL
  // =====================================================

  static get updateProfile() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços')
        .optional(),

      phone: z.string()
        .regex(/^\d{10,15}$/, 'Telefone deve conter entre 10 e 15 dígitos')
        .optional()
        .transform(phone => phone?.replace(/\D/g, '') || null)
    }).refine(data => {
      // Pelo menos um campo deve ser fornecido
      return data.name !== undefined || data.phone !== undefined;
    }, {
      message: 'Pelo menos um campo deve ser fornecido para atualização',
      path: ['update']
    });
  }

  // =====================================================
  // 🔐 SCHEMA PARA ALTERAÇÃO DE SENHA
  // =====================================================

  static get changePassword() {
    return z.object({
      currentPassword: z.string()
        .min(1, 'Senha atual é obrigatória'),

      newPassword: z.string()
        .min(6, 'Nova senha deve ter pelo menos 6 caracteres')
        .max(128, 'Nova senha deve ter no máximo 128 caracteres'),

      confirmNewPassword: z.string()
        .min(1, 'Confirmação da nova senha é obrigatória')
    }).refine(data => data.newPassword === data.confirmNewPassword, {
      message: 'Nova senha e confirmação não coincidem',
      path: ['confirmNewPassword']
    }).refine(data => data.currentPassword !== data.newPassword, {
      message: 'Nova senha deve ser diferente da senha atual',
      path: ['newPassword']
    });
  }

  // =====================================================
  // 📋 SCHEMA PARA LISTAGEM DE USUÁRIOS
  // =====================================================

  static get listUsers() {
    return z.object({
      page: z.string()
        .regex(/^\d+$/, 'Página deve ser um número')
        .transform(Number)
        .refine(val => val > 0, 'Página deve ser maior que 0')
        .default('1'),

      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 100, 'Limite deve ser entre 1 e 100')
        .default('10'),

      role: z.enum(['CLIENT', 'ADMIN'], 'Role deve ser CLIENT ou ADMIN')
        .optional(),

      is_active: z.string()
        .transform(val => {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return undefined;
        })
        .optional(),

      search: z.string()
        .trim()
        .min(2, 'Busca deve ter pelo menos 2 caracteres')
        .optional()
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get userId() {
    return z.object({
      id: z.string()
        .uuid('ID deve ser um UUID válido')
    });
  }

  // =====================================================
  // 🛡️ SCHEMA PARA CRIAÇÃO DE ADMIN (SUPER ADMIN)
  // =====================================================

  static get createAdmin() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços'),

      email: z.string()
        .email('Email deve ser um endereço válido')
        .max(255, 'Email deve ter no máximo 255 caracteres')
        .toLowerCase()
        .trim(),

      password: z.string()
        .min(8, 'Senha de admin deve ter pelo menos 8 caracteres')
        .max(128, 'Senha deve ter no máximo 128 caracteres')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Senha deve conter ao menos 1 minúscula, 1 maiúscula e 1 número'),

      phone: z.string()
        .regex(/^\d{10,15}$/, 'Telefone deve conter entre 10 e 15 dígitos')
        .optional()
        .transform(phone => phone?.replace(/\D/g, '') || null)
    });
  }

  // =====================================================
  // 🔍 SCHEMA PARA BUSCA DE USUÁRIOS
  // =====================================================

  static get searchUsers() {
    return z.object({
      q: z.string()
        .trim()
        .min(2, 'Termo de busca deve ter pelo menos 2 caracteres')
        .max(100, 'Termo de busca deve ter no máximo 100 caracteres'),

      role: z.enum(['CLIENT', 'ADMIN'], 'Role deve ser CLIENT ou ADMIN')
        .optional(),

      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 50, 'Limite deve ser entre 1 e 50')
        .default('20')
    });
  }

  // =====================================================
  // 📧 SCHEMA PARA RESET DE SENHA (FUTURO)
  // =====================================================

  static get forgotPassword() {
    return z.object({
      email: z.string()
        .email('Email deve ser um endereço válido')
        .toLowerCase()
        .trim()
    });
  }

  static get resetPassword() {
    return z.object({
      token: z.string()
        .min(1, 'Token de reset é obrigatório'),

      newPassword: z.string()
        .min(6, 'Nova senha deve ter pelo menos 6 caracteres')
        .max(128, 'Nova senha deve ter no máximo 128 caracteres'),

      confirmPassword: z.string()
        .min(1, 'Confirmação da senha é obrigatória')
    }).refine(data => data.newPassword === data.confirmPassword, {
      message: 'Nova senha e confirmação não coincidem',
      path: ['confirmPassword']
    });
  }

  // =====================================================
  // 🎛️ SCHEMA PARA HEADERS DE AUTORIZAÇÃO
  // =====================================================

  static get authHeader() {
    return z.object({
      authorization: z.string()
        .regex(/^Bearer\s+.+$/, 'Header Authorization deve estar no formato "Bearer <token>"')
    }).transform(data => {
      // Extrair token do header
      return {
        token: data.authorization.replace('Bearer ', '')
      };
    });
  }
}

module.exports = { AuthSchemas };