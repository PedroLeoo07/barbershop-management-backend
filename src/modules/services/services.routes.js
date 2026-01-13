const express = require('express');
const { ServiceController } = require('./services.controller');
const { AuthMiddleware } = require('../../middlewares/auth');
const { ValidationMiddleware } = require('../../middlewares/validation');
const { ServiceSchemas } = require('./services.schemas');

// =====================================================
// ROTAS PARA SERVIÇOS - NOVA ESTRUTURA
// =====================================================

const router = express.Router();
const serviceController = new ServiceController();

// =====================================================
// 📋 ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// =====================================================

// GET /api/services - Listar serviços (público)
router.get(
  '/',
  ValidationMiddleware.validateQuery(ServiceSchemas.listServices),
  serviceController.listServices
);

// GET /api/services/search - Buscar serviços (público)
router.get(
  '/search',
  ValidationMiddleware.validateQuery(ServiceSchemas.searchServices),
  serviceController.searchServices
);

// GET /api/services/popular - Serviços populares (público)
router.get(
  '/popular',
  ValidationMiddleware.validateQuery(ServiceSchemas.popularServices),
  serviceController.getPopularServices
);

// GET /api/services/active - Serviços ativos (público)
router.get(
  '/active',
  serviceController.getActiveServices
);

// POST /api/services/duration - Calcular duração total de serviços
router.post(
  '/duration',
  serviceController.getServicesDuration
);

// POST /api/services/price - Calcular preço total de serviços
router.post(
  '/price',
  serviceController.getServicesPrice
);

// GET /api/services/:id - Buscar serviço específico (público)
router.get(
  '/:id',
  ValidationMiddleware.validateParams(ServiceSchemas.serviceId),
  serviceController.getServiceById
);

// =====================================================
// 🔒 ROTAS PROTEGIDAS (APENAS ADMIN)
// =====================================================

// POST /api/services - Criar serviço (apenas admin)
router.post(
  '/',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests por 5 minutos
  serviceController.createService
);

// PUT /api/services/:id - Atualizar serviço (apenas admin)
router.put(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 20 }), // 20 requests por 5 minutos
  serviceController.updateService
);

// DELETE /api/services/:id - Deletar serviço (apenas admin)
router.delete(
  '/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 5 }), // 5 requests por 5 minutos
  serviceController.deleteService
);

// =====================================================
// 📊 ROTAS PARA RELATÓRIOS (APENAS ADMIN)
// =====================================================

// GET /api/services/reports/revenue - Relatório de receita por serviços (apenas admin)
router.get(
  '/reports/revenue',
  AuthMiddleware.authenticate,
  AuthMiddleware.requireAdmin,
  RateLimiter.create({ windowMs: 5 * 60 * 1000, max: 10 }), // 10 requests por 5 minutos
  serviceController.getServiceRevenue
);

module.exports = router;

// =====================================================
// 📝 DOCUMENTAÇÃO DAS ROTAS
// =====================================================

/* 
🔹 ROTAS PÚBLICAS (Sem Autenticação):

GET /api/services
  - Lista todos os serviços ativos
  - Query params: page, limit, is_active, category, search, price_min, price_max, duration_min, duration_max, is_combo
  - Rate limit: 30/minuto

GET /api/services/search?q=termo
  - Busca serviços por nome, descrição ou categoria
  - Query params: q (obrigatório), limit
  - Rate limit: 20/minuto

GET /api/services/popular?days=30&limit=10
  - Lista serviços mais populares dos últimos X dias
  - Query params: days, limit
  - Rate limit: 20/minuto

GET /api/services/categories
  - Lista todas as categorias de serviços com estatísticas
  - Rate limit: 30/minuto

GET /api/services/:id
  - Busca serviço específico por ID
  - Rate limit: 30/minuto

🔹 ROTAS ADMINISTRATIVAS (Apenas Admin):

POST /api/services
  - Cria novo serviço
  - Body: { 
      name, 
      description?, 
      price_min, 
      price_max?, 
      duration_min, 
      duration_max?, 
      category?, 
      is_combo?, 
      is_active? 
    }
  - Rate limit: 10/5min

PUT /api/services/:id
  - Atualiza serviço existente
  - Body: Campos a atualizar (todos opcionais)
  - Rate limit: 20/5min

DELETE /api/services/:id
  - Remove serviço (soft delete)
  - Não permite se houver agendamentos futuros
  - Rate limit: 5/5min

GET /api/services/reports/revenue?start_date=2024-01-01&end_date=2024-01-31
  - Relatório de receita dos serviços
  - Query params: start_date?, end_date?, service_id?, category?, period?
  - Rate limit: 10/5min

🔹 EXEMPLOS DE USO:

Buscar serviços de corte:
GET /api/services?category=corte&is_active=true

Buscar serviços por preço:
GET /api/services?price_min=20&price_max=50

Buscar serviços por duração:
GET /api/services?duration_min=30&duration_max=60

Buscar serviços populares:
GET /api/services/popular?days=7&limit=5

Relatório mensal de receita:
GET /api/services/reports/revenue?period=month

🔹 CATEGORIAS VÁLIDAS:
- corte: Cortes de cabelo
- barba: Serviços de barba
- sobrancelha: Design de sobrancelha  
- tratamento: Tratamentos capilares
- combo: Pacotes combinados
- especial: Serviços especiais/premium
- geral: Categoria geral

🔹 PERMISSÕES:
  ✅ ADMIN: Pode gerenciar serviços (CRUD completo)
  ✅ CLIENT: Pode apenas visualizar serviços ativos
  ✅ PÚBLICO: Pode visualizar serviços para agendamentos

🔹 RATE LIMITING:
  - Rotas públicas: 20-30 requests/minuto
  - Rotas admin: 5-20 requests/5 minutos
  - Busca e listagem: 20-30 requests/minuto
  - Operações críticas: 5-10 requests/5 minutos
*/