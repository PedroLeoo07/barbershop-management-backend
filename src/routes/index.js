const { Router } = require('express');

// Importar rotas dos módulos
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/users/users.routes');
const barberRoutes = require('../modules/barbers/barbers.routes');
const serviceRoutes = require('../modules/services/services.routes');
const appointmentRoutes = require('./appointmentRoutes');

const router = Router();

// =====================================================
// 🔗 APLICAR ROTAS COM PREFIXOS
// =====================================================

// Autenticação (registro, login, refresh token)
router.use('/auth', authRoutes);

// Usuários (admin pode gerenciar, user pode ver próprio perfil)
router.use('/users', userRoutes);

// Barbeiros (admin gerencia, público visualiza)
router.use('/barbers', barberRoutes);

// Serviços (admin gerencia, público visualiza)
router.use('/services', serviceRoutes);

// Agendamentos (client cria, admin gerencia)
router.use('/appointments', appointmentRoutes);

// =====================================================
// ❤️ ROTA DE HEALTH CHECK
// =====================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API da Barbearia funcionando corretamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// =====================================================
// ℹ️ ROTA DE INFORMAÇÕES DA API
// =====================================================

router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema Profissional de Gestão de Barbearia',
    version: '2.0.0',
    description: 'API completa com autenticação JWT, controle de permissões e sistema de agendamentos inteligente',
    features: [
      '🔐 Autenticação JWT com Refresh Token',
      '👥 Sistema completo de usuários (Admin/Client)',
      '💈 Gestão de barbeiros com especialidades',
      '🛠️ CRUD de serviços por categorias',
      '📅 Sistema inteligente de agendamentos',
      '⏰ Verificação automática de conflitos',
      '🔒 Controle rigoroso de permissões',
      '📊 Relatórios de performance e receita',
      '🔄 Rate limiting por endpoint',
      '🛡️ Validação robusta com Zod',
      '💾 Transações SQL com locks'
    ],
    permissions: {
      admin: 'Pode criar/gerenciar usuários, barbeiros, serviços e ver todos os agendamentos',
      client: 'Pode criar agendamentos e gerenciar seu próprio perfil',
      public: 'Pode visualizar barbeiros e serviços ativos'
    },
    endpoints: {
      auth: {
        path: '/api/auth',
        description: 'Registro, login, refresh token e perfil'
      },
      users: {
        path: '/api/users',
        description: 'Gerenciamento de usuários (admin) e perfil (user)'
      },
      barbers: {
        path: '/api/barbers',
        description: 'CRUD de barbeiros (admin) e visualização (público)'
      },
      services: {
        path: '/api/services',
        description: 'CRUD de serviços (admin) e catálogo (público)'
      },
      appointments: {
        path: '/api/appointments',
        description: 'Agendamentos (client cria, admin gerencia)'
      }
    },
    database: {
      entities: ['Users', 'Barbers', 'Services', 'Appointments', 'Business Hours'],
      features: ['UUID primary keys', 'Soft deletes', 'Audit trails', 'Constraints']
    },
    documentation: 'Veja os comentários em cada arquivo de rotas para detalhes dos endpoints'
  });
});

module.exports = { apiRoutes: router };