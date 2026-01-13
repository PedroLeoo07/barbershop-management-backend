const { z } = require('zod');

// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA SERVIÇOS - NOVA ESTRUTURA
// =====================================================

class ServiceSchemas {
  // =====================================================
  // 🔧 SCHEMA PARA CRIAÇÃO DE SERVIÇOS
  // =====================================================

  static get createService() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ0-9\s\-\.+]+$/.test(name), 'Nome deve conter apenas letras, números, espaços, hifens, pontos e +'),

      duration_minutes: z.number()
        .int('Duração deve ser um número inteiro')
        .min(1, 'Duração deve ser maior que 0')
        .max(480, 'Duração deve ser no máximo 8 horas (480 minutos)'),

      price: z.number()
        .positive('Preço deve ser positivo')
        .max(10000, 'Preço deve ser no máximo R$ 10.000')
        .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais'),

      active: z.boolean()
        .optional()
        .default(true)
    });
  }

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE SERVIÇOS
  // =====================================================

  static get updateService() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ0-9\s\-\.+]+$/.test(name), 'Nome deve conter apenas letras, números, espaços, hifens, pontos e +')
        .optional(),

      duration_minutes: z.number()
        .int('Duração deve ser um número inteiro')
        .min(1, 'Duração deve ser maior que 0')
        .max(480, 'Duração deve ser no máximo 8 horas (480 minutos)')
        .optional(),

      price: z.number()
        .positive('Preço deve ser positivo')
        .max(10000, 'Preço deve ser no máximo R$ 10.000')
        .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais')
        .optional(),

      active: z.boolean()
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
  // 📋 SCHEMA PARA LISTAGEM DE SERVIÇOS
  // =====================================================

  static get listServices() {
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

      active: z.string()
        .transform(val => {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return undefined;
        })
        .optional(),

      search: z.string()
        .trim()
        .min(2, 'Busca deve ter pelo menos 2 caracteres')
        .max(100, 'Busca deve ter no máximo 100 caracteres')
        .optional(),

      price_min: z.string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Preço mínimo deve ser um número válido')
        .transform(Number)
        .refine(val => val > 0 && val <= 10000, 'Preço mínimo deve ser entre 0 e 10000')
        .optional(),

      price_max: z.string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Preço máximo deve ser um número válido')
        .transform(Number)
        .refine(val => val > 0 && val <= 10000, 'Preço máximo deve ser entre 0 e 10000')
        .optional(),

      duration_min: z.string()
        .regex(/^\d+$/, 'Duração mínima deve ser um número')
        .transform(Number)
        .refine(val => val >= 1 && val <= 480, 'Duração mínima deve ser entre 1 e 480 minutos')
        .optional(),

      duration_max: z.string()
        .regex(/^\d+$/, 'Duração máxima deve ser um número')
        .transform(Number)
        .refine(val => val >= 1 && val <= 480, 'Duração máxima deve ser entre 1 e 480 minutos')
        .optional()
    }).refine(data => {
      // Validar range de preços se ambos foram fornecidos
      if (data.price_min !== undefined && data.price_max !== undefined) {
        return data.price_max >= data.price_min;
      }
      return true;
    }, {
      message: 'Preço máximo deve ser maior ou igual ao preço mínimo',
      path: ['price_range']
    }).refine(data => {
      // Validar range de duração se ambos foram fornecidos
      if (data.duration_min !== undefined && data.duration_max !== undefined) {
        return data.duration_max >= data.duration_min;
      }
      return true;
    }, {
      message: 'Duração máxima deve ser maior ou igual à duração mínima',
      path: ['duration_range']
    });
  }

  // =====================================================
  // 🔍 SCHEMA PARA BUSCA DE SERVIÇOS
  // =====================================================

  static get searchServices() {
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
  // 📊 SCHEMA PARA SERVIÇOS POPULARES
  // =====================================================

  static get popularServices() {
    return z.object({
      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 50, 'Limite deve ser entre 1 e 50')
        .default('10'),

      days: z.string()
        .regex(/^\d+$/, 'Dias deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 365, 'Dias deve ser entre 1 e 365')
        .default('30')
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get serviceId() {
    return z.object({
      id: z.string()
        .uuid('ID do serviço deve ser um UUID válido')
    });
  }
}

module.exports = { ServiceSchemas };

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE SERVIÇOS
  // =====================================================

  static get updateService() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ0-9\s\-\.]+$/.test(name), 'Nome deve conter apenas letras, números, espaços, hifens e pontos')
        .optional(),

      description: z.string()
        .max(500, 'Descrição deve ter no máximo 500 caracteres')
        .trim()
        .optional()
        .nullable(),

      price_min: z.number()
        .positive('Preço mínimo deve ser positivo')
        .max(10000, 'Preço mínimo deve ser no máximo R$ 10.000')
        .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais')
        .optional(),

      price_max: z.number()
        .positive('Preço máximo deve ser positivo')
        .max(10000, 'Preço máximo deve ser no máximo R$ 10.000')
        .multipleOf(0.01, 'Preço deve ter no máximo 2 casas decimais')
        .optional(),

      duration_min: z.number()
        .int('Duração mínima deve ser um número inteiro')
        .min(15, 'Duração mínima deve ser de pelo menos 15 minutos')
        .max(480, 'Duração mínima deve ser no máximo 8 horas (480 minutos)')
        .optional(),

      duration_max: z.number()
        .int('Duração máxima deve ser um número inteiro')
        .min(15, 'Duração máxima deve ser de pelo menos 15 minutos')
        .max(480, 'Duração máxima deve ser no máximo 8 horas (480 minutos)')
        .optional(),

      category: z.enum(['corte', 'barba', 'sobrancelha', 'tratamento', 'combo', 'especial', 'geral'], 
        'Categoria deve ser: corte, barba, sobrancelha, tratamento, combo, especial ou geral')
        .optional(),

      is_combo: z.boolean()
        .optional(),

      is_active: z.boolean()
        .optional()
    }).refine(data => {
      // Pelo menos um campo deve ser fornecido
      return Object.keys(data).length > 0;
    }, {
      message: 'Pelo menos um campo deve ser fornecido para atualização',
      path: ['update']
    }).refine(data => {
      // Se ambos price_min e price_max foram fornecidos, validar range
      if (data.price_min !== undefined && data.price_max !== undefined) {
        return data.price_max >= data.price_min;
      }
      return true;
    }, {
      message: 'Preço máximo deve ser maior ou igual ao preço mínimo',
      path: ['price_range']
    }).refine(data => {
      // Se ambos duration_min e duration_max foram fornecidos, validar range
      if (data.duration_min !== undefined && data.duration_max !== undefined) {
        return data.duration_max >= data.duration_min;
      }
      return true;
    }, {
      message: 'Duração máxima deve ser maior ou igual à duração mínima',
      path: ['duration_range']
    });
  }

  // =====================================================
  // 📋 SCHEMA PARA LISTAGEM DE SERVIÇOS
  // =====================================================

  static get listServices() {
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

      is_active: z.string()
        .transform(val => {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return undefined;
        })
        .optional(),

      category: z.enum(['corte', 'barba', 'sobrancelha', 'tratamento', 'combo', 'especial', 'geral'])
        .optional(),

      search: z.string()
        .trim()
        .min(2, 'Busca deve ter pelo menos 2 caracteres')
        .max(100, 'Busca deve ter no máximo 100 caracteres')
        .optional(),

      price_min: z.string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Preço mínimo deve ser um número válido')
        .transform(Number)
        .refine(val => val > 0 && val <= 10000, 'Preço mínimo deve ser entre 0 e 10000')
        .optional(),

      price_max: z.string()
        .regex(/^\d+(\.\d{1,2})?$/, 'Preço máximo deve ser um número válido')
        .transform(Number)
        .refine(val => val > 0 && val <= 10000, 'Preço máximo deve ser entre 0 e 10000')
        .optional(),

      duration_min: z.string()
        .regex(/^\d+$/, 'Duração mínima deve ser um número')
        .transform(Number)
        .refine(val => val >= 15 && val <= 480, 'Duração mínima deve ser entre 15 e 480 minutos')
        .optional(),

      duration_max: z.string()
        .regex(/^\d+$/, 'Duração máxima deve ser um número')
        .transform(Number)
        .refine(val => val >= 15 && val <= 480, 'Duração máxima deve ser entre 15 e 480 minutos')
        .optional(),

      is_combo: z.string()
        .transform(val => {
          if (val === 'true') return true;
          if (val === 'false') return false;
          return undefined;
        })
        .optional()
    }).refine(data => {
      // Validar range de preços se ambos foram fornecidos
      if (data.price_min !== undefined && data.price_max !== undefined) {
        return data.price_max >= data.price_min;
      }
      return true;
    }, {
      message: 'Preço máximo deve ser maior ou igual ao preço mínimo',
      path: ['price_range']
    }).refine(data => {
      // Validar range de duração se ambos foram fornecidos
      if (data.duration_min !== undefined && data.duration_max !== undefined) {
        return data.duration_max >= data.duration_min;
      }
      return true;
    }, {
      message: 'Duração máxima deve ser maior ou igual à duração mínima',
      path: ['duration_range']
    });
  }

  // =====================================================
  // 🔍 SCHEMA PARA BUSCA DE SERVIÇOS
  // =====================================================

  static get searchServices() {
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
  // 📊 SCHEMA PARA SERVIÇOS POPULARES
  // =====================================================

  static get popularServices() {
    return z.object({
      limit: z.string()
        .regex(/^\d+$/, 'Limite deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 50, 'Limite deve ser entre 1 e 50')
        .default('10'),

      days: z.string()
        .regex(/^\d+$/, 'Dias deve ser um número')
        .transform(Number)
        .refine(val => val > 0 && val <= 365, 'Dias deve ser entre 1 e 365')
        .default('30')
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get serviceId() {
    return z.object({
      id: z.string()
        .uuid('ID do serviço deve ser um UUID válido')
    });
  }

  // =====================================================
  // 📊 SCHEMA PARA RELATÓRIO DE RECEITA
  // =====================================================

  static get serviceRevenue() {
    return z.object({
      start_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD')
        .optional(),

      end_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD')
        .optional(),

      service_id: z.string()
        .uuid('ID do serviço deve ser um UUID válido')
        .optional(),

      category: z.enum(['corte', 'barba', 'sobrancelha', 'tratamento', 'combo', 'especial', 'geral'])
        .optional(),

      period: z.enum(['week', 'month', 'quarter', 'year'], 'Período deve ser: week, month, quarter ou year')
        .optional()
    }).refine(data => {
      // Se especificou start_date, deve especificar end_date
      if (data.start_date && !data.end_date) {
        return false;
      }
      if (data.end_date && !data.start_date) {
        return false;
      }
      // Verificar se start_date <= end_date
      if (data.start_date && data.end_date) {
        return new Date(data.start_date) <= new Date(data.end_date);
      }
      return true;
    }, {
      message: 'Datas inválidas: start_date deve ser <= end_date e ambas devem ser fornecidas',
      path: ['dates']
    }).transform(data => {
      // Se especificou period, calcular datas automaticamente
      if (data.period && !data.start_date && !data.end_date) {
        const now = new Date();
        const end = new Date(now);
        let start = new Date(now);

        switch (data.period) {
          case 'week':
            start.setDate(start.getDate() - 7);
            break;
          case 'month':
            start.setMonth(start.getMonth() - 1);
            break;
          case 'quarter':
            start.setMonth(start.getMonth() - 3);
            break;
          case 'year':
            start.setFullYear(start.getFullYear() - 1);
            break;
        }

        return {
          ...data,
          start_date: start.toISOString().split('T')[0],
          end_date: end.toISOString().split('T')[0]
        };
      }

      return data;
    });
  }

  // =====================================================
  // 📂 SCHEMA VAZIO PARA CATEGORIAS
  // =====================================================

  static get categories() {
    return z.object({
      // Sem parâmetros necessários
    });
  }
}

module.exports = { ServiceSchemas };