import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { appointmentRoutes } from './appointmentRoutes';
// import { serviceRoutes } from './serviceRoutes';
// import { userRoutes } from './userRoutes';
// import { barberRoutes } from './barberRoutes';
// import { dashboardRoutes } from './dashboardRoutes';

const router = Router();

// Aplicar rotas com prefixos
router.use('/auth', authRoutes);
router.use('/appointments', appointmentRoutes);
// router.use('/services', serviceRoutes);
// router.use('/users', userRoutes);
// router.use('/barbers', barberRoutes);
// router.use('/dashboard', dashboardRoutes);

// Rota de health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando corretamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Rota de informações da API
router.get('/info', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de Gestão de Barbearia',
    version: '1.0.0',
    features: [
      'Autenticação JWT com Refresh Token',
      'CRUD completo de usuários, barbeiros e serviços',
      'Sistema inteligente de agendamentos',
      'Verificação de conflitos de horário',
      'Dashboard administrativo',
      'Relatórios de performance',
    ],
    endpoints: {
      auth: '/api/auth',
      appointments: '/api/appointments',
      services: '/api/services',
      users: '/api/users',
      barbers: '/api/barbers',
      dashboard: '/api/dashboard',
    }
  });
});

export { router as apiRoutes };