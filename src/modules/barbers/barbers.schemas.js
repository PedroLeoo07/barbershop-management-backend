const { z } = require('zod');

// =====================================================
// SCHEMAS DE VALIDAÇÃO PARA BARBEIROS - NOVA ESTRUTURA
// =====================================================

class BarberSchemas {
  // =====================================================
  // 🔧 SCHEMA PARA CRIAÇÃO DE BARBEIROS
  // =====================================================

  static get createBarber() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços'),

      active: z.boolean()
        .optional()
        .default(true)
    });
  }

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE BARBEIROS
  // =====================================================

  static get updateBarber() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços')
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
  // 📋 SCHEMA PARA LISTAGEM DE BARBEIROS
  // =====================================================

  static get listBarbers() {
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
        .optional()
    });
  }

  // =====================================================
  // 🔍 SCHEMA PARA BUSCA DE BARBEIROS
  // =====================================================

  static get searchBarbers() {
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
  // 📊 SCHEMA PARA BARBEIROS DISPONÍVEIS
  // =====================================================

  static get availableBarbers() {
    return z.object({
      date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
        .refine(date => {
          const appointmentDate = new Date(date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return appointmentDate >= today;
        }, 'Data deve ser hoje ou no futuro'),

      time: z.string()
        .regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM')
        .refine(time => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
        }, 'Horário inválido'),

      duration: z.string()
        .regex(/^\d+$/, 'Duração deve ser um número')
        .transform(Number)
        .refine(val => val >= 15 && val <= 480, 'Duração deve ser entre 15 e 480 minutos')
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get barberId() {
    return z.object({
      id: z.string()
        .uuid('ID do barbeiro deve ser um UUID válido')
    });
  }
}

module.exports = { BarberSchemas };

  // =====================================================
  // ✏️ SCHEMA PARA ATUALIZAÇÃO DE BARBEIROS
  // =====================================================

  static get updateBarber() {
    return z.object({
      name: z.string()
        .min(2, 'Nome deve ter pelo menos 2 caracteres')
        .max(100, 'Nome deve ter no máximo 100 caracteres')
        .trim()
        .refine(name => /^[a-zA-ZÀ-ÿ\s]+$/.test(name), 'Nome deve conter apenas letras e espaços')
        .optional(),

      description: z.string()
        .max(500, 'Descrição deve ter no máximo 500 caracteres')
        .trim()
        .optional()
        .nullable(),

      user_id: z.string()
        .uuid('User ID deve ser um UUID válido')
        .optional()
        .nullable(),

      experience_years: z.number()
        .int('Experiência deve ser um número inteiro')
        .min(0, 'Experiência não pode ser negativa')
        .max(50, 'Experiência não pode ser maior que 50 anos')
        .optional(),

      specialties: z.array(z.string().trim())
        .max(10, 'Máximo 10 especialidades permitidas')
        .optional()
        .refine(specialties => {
          if (!specialties) return true;
          return new Set(specialties).size === specialties.length;
        }, 'Especialidades não podem estar duplicadas')
        .refine(specialties => {
          if (!specialties) return true;
          return specialties.every(s => s.length >= 2 && s.length <= 50);
        }, 'Cada especialidade deve ter entre 2 e 50 caracteres'),

      avatar_url: z.string()
        .url('Avatar deve ser uma URL válida')
        .optional()
        .nullable(),

      is_active: z.boolean()
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
  // 📋 SCHEMA PARA LISTAGEM DE BARBEIROS
  // =====================================================

  static get listBarbers() {
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

      search: z.string()
        .trim()
        .min(2, 'Busca deve ter pelo menos 2 caracteres')
        .max(100, 'Busca deve ter no máximo 100 caracteres')
        .optional(),

      experience_min: z.string()
        .regex(/^\d+$/, 'Experiência mínima deve ser um número')
        .transform(Number)
        .refine(val => val >= 0 && val <= 50, 'Experiência deve ser entre 0 e 50 anos')
        .optional(),

      specialty: z.string()
        .trim()
        .min(2, 'Especialidade deve ter pelo menos 2 caracteres')
        .max(50, 'Especialidade deve ter no máximo 50 caracteres')
        .optional()
    });
  }

  // =====================================================
  // 🔍 SCHEMA PARA BUSCA DE BARBEIROS
  // =====================================================

  static get searchBarbers() {
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
  // 📊 SCHEMA PARA BARBEIROS DISPONÍVEIS
  // =====================================================

  static get availableBarbers() {
    return z.object({
      date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
        .refine(date => {
          const appointmentDate = new Date(date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return appointmentDate >= today;
        }, 'Data deve ser hoje ou no futuro')
        .optional(),

      time: z.string()
        .regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM')
        .refine(time => {
          const [hours, minutes] = time.split(':').map(Number);
          return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
        }, 'Horário inválido')
        .optional(),

      duration: z.string()
        .regex(/^\d+$/, 'Duração deve ser um número')
        .transform(Number)
        .refine(val => val >= 15 && val <= 480, 'Duração deve ser entre 15 e 480 minutos')
        .optional()
    }).refine(data => {
      // Se especificou time, deve especificar date e duration
      if (data.time) {
        return data.date && data.duration;
      }
      return true;
    }, {
      message: 'Se especificar horário, deve informar data e duração',
      path: ['time']
    });
  }

  // =====================================================
  // 🎯 SCHEMA PARA PARÂMETROS DE ID
  // =====================================================

  static get barberId() {
    return z.object({
      id: z.string()
        .uuid('ID do barbeiro deve ser um UUID válido')
    });
  }

  // =====================================================
  // 📊 SCHEMA PARA PERFORMANCE/RELATÓRIOS
  // =====================================================

  static get barberPerformance() {
    return z.object({
      barber_id: z.string()
        .uuid('ID do barbeiro deve ser um UUID válido')
        .optional(),

      start_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inicial deve estar no formato YYYY-MM-DD')
        .optional(),

      end_date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data final deve estar no formato YYYY-MM-DD')
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
  // 🏷️ SCHEMA PARA ESPECIALIDADES
  // =====================================================

  static get addSpecialty() {
    return z.object({
      specialty: z.string()
        .trim()
        .min(2, 'Especialidade deve ter pelo menos 2 caracteres')
        .max(50, 'Especialidade deve ter no máximo 50 caracteres')
        .refine(s => /^[a-zA-ZÀ-ÿ\s\-]+$/.test(s), 'Especialidade deve conter apenas letras, espaços e hifens')
    });
  }

  static get removeSpecialty() {
    return z.object({
      specialty: z.string()
        .trim()
        .min(1, 'Especialidade é obrigatória')
    });
  }
}

module.exports = { BarberSchemas };