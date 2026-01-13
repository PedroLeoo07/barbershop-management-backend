const { Router } = require('express');

const router = Router();

// Rota temporária simplificada para teste
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Rotas de appointments em desenvolvimento',
    data: []
  });
});

module.exports = { appointmentRoutes: router };