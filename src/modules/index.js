// =====================================================
// 📦 MÓDULOS DO SISTEMA DE BARBEARIA
// =====================================================

module.exports = {
  // Módulo de Autenticação
  auth: require('./auth'),
  
  // Módulo de Usuários
  users: require('./users'),
  
  // Módulo de Barbeiros
  barbers: require('./barbers'),
  
  // Módulo de Serviços
  services: require('./services'),
  
  // Módulo Base (para herança)
  BaseRepository: require('./base.repository').BaseRepository
};