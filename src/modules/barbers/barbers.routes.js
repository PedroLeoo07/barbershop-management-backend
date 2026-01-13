const express = require('express');
const { BarberController } = require('./barbers.controller');
const { AuthMiddleware } = require('../../middlewares/auth');
const { RateLimiter } = require('../../middlewares/security');

// =====================================================
// ROTAS PARA BARBEIROS
// =====================================================

const router = express.Router();
const barberController = new BarberController();

// =====================================================
// 📋 ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// =====================================================

// GET /api/barbers - Listar barbeiros (público, para clientes verem)
router.get(
  '/',
  RateLimiter.create({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests por minuto
  barberController.listBarbers
);

// GET /api/barbers/search - Buscar barbeiros (público)
router.get(
  '/search',
  RateLimiter.create({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests por minuto
  barberController.searchBarbers
);

// GET /api/barbers/available - Barbeiros disponíveis (público)
router.get(
  '/available',
  RateLimiter.create({ windowMs: 1 * 60 * 1000, max: 20 }), // 20 requests por minuto
  barberController.getAvailableBarbers
);

// GET /api/barbers/:id - Buscar barbeiro específico (público)
router.get(
  '/:id',
  RateLimiter.create({ windowMs: 1 * 60 * 1000, max: 30 }), // 30 requests por minuto
  barberController.getBarberById
);

// =====================================================
// 🔒 ROTAS PROTEGIDAS (APENAS ADMIN)
// =====================================================

// POST /api/barbers - Criar barbeiro (apenas admin)
router.post(
  '/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests por 5 minutos
  barberController.createBarber
);

// PUT /api/barbers/:id - Atualizar barbeiro (apenas admin)
router.put(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 requests por 5 minutos
  barberController.updateBarber
);

// DELETE /api/barbers/:id - Deletar barbeiro (apenas admin)
router.delete(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 5 }), // 5 requests por 5 minutos
  barberController.deleteBarber
);

// =====================================================
// 🏷️ ROTAS PARA ESPECIALIDADES (APENAS ADMIN)
// =====================================================

// POST /api/barbers/:id/specialties - Adicionar especialidade (apenas admin)
router.post(
  '/:id/specialties',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 requests por 5 minutos
  barberController.addSpecialty
);

// DELETE /api/barbers/:id/specialties - Remover especialidade (apenas admin)
router.delete(
  '/:id/specialties',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 requests por 5 minutos
  barberController.removeSpecialty
);

// =====================================================
// 📊 ROTAS PARA RELATÓRIOS (APENAS ADMIN)
// =====================================================

// GET /api/barbers/reports/performance - Relatório de performance (apenas admin)
router.get(
  '/reports/performance',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests por 5 minutos
  barberController.getBarberPerformance
);

module.exports = router;

// =====================================================
// 📝 DOCUMENTAÇÃO DAS ROTAS
// =====================================================

/* 
🔹 ROTAS PÚBLICAS (Sem Autenticação):

GET /api/barbers
  - Lista todos os barbeiros ativos
  - Query params: page, limit, search, is_active, experience_min, specialty
  - Rate limit: 30/minuto

GET /api/barbers/search?q=termo
  - Busca barbeiros por nome ou especialidade
  - Query params: q (obrigatório), limit
  - Rate limit: 20/minuto

GET /api/barbers/available?date=2024-01-15&time=14:00&duration=60
  - Lista barbeiros disponíveis para um horário específico
  - Query params: date, time, duration
  - Rate limit: 20/minuto

GET /api/barbers/:id
  - Busca barbeiro por ID
  - Rate limit: 30/minuto

🔹 ROTAS ADMINISTRATIVAS (Apenas Admin):

POST /api/barbers
  - Cria novo barbeiro
  - Body: { name, description?, user_id?, experience_years?, specialties?, avatar_url?, is_active? }
  - Rate limit: 10/5min

PUT /api/barbers/:id
  - Atualiza barbeiro existente
  - Body: Campos a atualizar (todos opcionais)
  - Rate limit: 20/5min

DELETE /api/barbers/:id
  - Remove barbeiro (soft delete)
  - Rate limit: 5/5min

POST /api/barbers/:id/specialties
  - Adiciona especialidade ao barbeiro
  - Body: { specialty }
  - Rate limit: 20/5min

DELETE /api/barbers/:id/specialties
  - Remove especialidade do barbeiro
  - Body: { specialty }
  - Rate limit: 20/5min

GET /api/barbers/reports/performance?barber_id=xxx&period=month
  - Relatório de performance dos barbeiros
  - Query params: barber_id?, start_date?, end_date?, period?
  - Rate limit: 10/5min

🔹 PERMISSÕES:
  ✅ ADMIN: Pode gerenciar barbeiros (CRUD completo)
  ✅ CLIENT: Pode apenas visualizar barbeiros ativos
  ✅ PÚBLICO: Pode visualizar barbeiros para agendamentos

🔹 RATE LIMITING:
  - Rotas públicas: 20-30 requests/minuto
  - Rotas admin: 5-20 requests/5 minutos
  - Busca e listagem: 20-30 requests/minuto
  - Operações críticas: 5-10 requests/5 minutos
*/