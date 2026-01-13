const { z } = require('zod');

// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA USUÁRIOS - NOVA ESTRUTURA
// =====================================================

class UserSchemas {
  // =====================================================
  // 🔧 SCHEMA PARA CRIAÇÃO DE USUÁRIOS
  // =====================================================

  static get createUser() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços'),

      email: z.string()
        .email('Email deve ter um formato válido')
        .max(150, 'Email deve ter no máximo 150 caracteres')
        .trim()
        .toLowerCase(),

      password: z.string()
        .min(6, 'Senha deve ter pelo menos 6 caracteres')
        .max(100, 'Senha deve ter no máximo 100 caracteres'),

      role: z.enum(['CLIENT', 'ADMIN'], 'Role deve ser CLIENT ou ADMIN')
        .default('CLIENT')
    });
  }

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE USUÁRIOS
  // =====================================================

  static get updateUser() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços')
        .optional(),

      email: z.string()
        .email('Email deve ter um formato válido')
        .max(150, 'Email deve ter no máximo 150 caracteres')
        .trim()
        .toLowerCase()
        .optional()
    }).refine(data => {
      // Pelo menos um campo deve ser fornecido
      return Object.keys(data).length > 0;
    }, {
      message: 'Pelo menos um campo deve ser fornecido para atualização',
      path: ['update']
    });
  }

  // =====================================================
  // 🔒 SCHEMA PARA MUDANÇA DE ROLE (APENAS ADMIN)
  // =====================================================

  static get updateRole() {
    return z.object({
      role: z.enum(['CLIENT', 'ADMIN'], 'Role deve ser CLIENT ou ADMIN')
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
        .refine(val => val > 0 && val <= 50, 'Limite deve ser entre 1 e 50')
        .default('10'),

      role: z.enum(['CLIENT', 'ADMIN'])
        .optional(),

      search: z.string()
        .trim()
        .min(2, 'Busca deve ter pelo menos 2 caracteres')
        .max(100, 'Busca deve ter no máximo 100 caracteres')
        .optional()
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

      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 50, 'Limite deve ser entre 1 e 50')
        .default('20')
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get userId() {
    return z.object({
      id: z.string()
        .uuid('ID do usuário deve ser um UUID válido')
    });
  }
}

module.exports = { UserSchemas };