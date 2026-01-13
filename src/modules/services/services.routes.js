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

// GET /api/services/:id/similar - Serviços similares (público)
router.get(
  '/:id/similar',
  ValidationMiddleware.validateParams(ServiceSchemas.serviceId),
  serviceController.getSimilarServices
);

// =====================================================
// 🔒 ROTAS PROTEGIDAS (APENAS ADMIN)
// =====================================================

// POST /api/services - Criar serviço (apenas admin)
router.post(
  '/',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateBody(ServiceSchemas.createService),
  serviceController.createService
);

// PUT /api/services/:id - Atualizar serviço (apenas admin)
router.put(
  '/:id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateParams(ServiceSchemas.serviceId),
  ValidationMiddleware.validateBody(ServiceSchemas.updateService),
  serviceController.updateService
);

// DELETE /api/services/:id - Deletar serviço (apenas admin)
router.delete(
  '/:id',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateParams(ServiceSchemas.serviceId),
  serviceController.deleteService
);

// PATCH /api/services/:id/toggle - Alternar status do serviço (apenas admin)
router.patch(
  '/:id/toggle',
  AuthMiddleware.authenticate,
  ValidationMiddleware.validateParams(ServiceSchemas.serviceId),
  serviceController.toggleServiceStatus
);

// =====================================================
// 📊 ROTAS PARA ESTATÍSTICAS (APENAS ADMIN)
// =====================================================

// GET /api/services/admin/stats - Estatísticas dos serviços (apenas admin)
router.get(
  '/admin/stats',
  AuthMiddleware.authenticate,
  serviceController.getServiceStats
);

module.exports = router;

// =====================================================
// 📝 DOCUMENTAÇÃO DAS ROTAS - NOVA ESTRUTURA
// =====================================================

/* 
🔹 ROTAS PÚBLICAS (Sem Autenticação):

GET /api/services
  - Lista todos os serviços com filtros e paginação
  - Query params: page, limit, active, search, price_min, price_max, duration_min, duration_max
  - Exemplo: GET /api/services?page=1&limit=10&active=true&price_min=20&price_max=100

GET /api/services/search?q=termo&limit=20
  - Busca serviços por nome
  - Query params: q (obrigatório), limit
  - Exemplo: GET /api/services/search?q=corte

GET /api/services/popular?limit=10&days=30
  - Lista serviços mais populares dos últimos X dias
  - Query params: limit, days
  - Exemplo: GET /api/services/popular?limit=5&days=7

GET /api/services/active
  - Lista apenas serviços ativos
  - Exemplo: GET /api/services/active

POST /api/services/duration
  - Calcula duração total de lista de serviços
  - Body: { service_ids: ["uuid1", "uuid2", ...] }
  - Response: { total_duration_minutes: 90 }

POST /api/services/price
  - Calcula preço total de lista de serviços
  - Body: { service_ids: ["uuid1", "uuid2", ...] }
  - Response: { total_price: 150.00 }

GET /api/services/:id
  - Busca serviço específico por ID
  - Exemplo: GET /api/services/550e8400-e29b-41d4-a716-446655440000

GET /api/services/:id/similar?limit=5
  - Busca serviços similares (baseado em preço/duração)
  - Query params: limit
  - Exemplo: GET /api/services/550e8400-e29b-41d4-a716-446655440000/similar

🔹 ROTAS ADMINISTRATIVAS (Apenas Admin):

POST /api/services
  - Cria novo serviço
  - Body: { 
      name: "Corte Masculino",
      duration_minutes: 45,
      price: 35.00,
      active?: true
    }

PUT /api/services/:id
  - Atualiza serviço existente
  - Body: Campos a atualizar (todos opcionais)
  - Exemplo: { name: "Novo Nome", price: 40.00 }

DELETE /api/services/:id
  - Remove serviço permanentemente
  - Não permite se houver agendamentos futuros

PATCH /api/services/:id/toggle
  - Alterna status ativo/inativo do serviço
  - Response: serviço com novo status

GET /api/services/admin/stats
  - Estatísticas dos serviços (total, ativos, populares, etc.)
  - Response: { total, active, inactive, average_price, average_duration }

🔹 ESTRUTURA DO SERVIÇO:
{
  id: "uuid",
  name: "Nome do Serviço",
  duration_minutes: 45,
  price: 35.00,
  active: true,
  created_at: "2024-01-15T10:00:00Z",
  updated_at: "2024-01-15T10:00:00Z"
}

🔹 FILTROS DISPONÍVEIS:
- active: true/false (serviços ativos/inativos)
- search: busca por nome
- price_min/price_max: faixa de preço
- duration_min/duration_max: faixa de duração
- page/limit: paginação
*/

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