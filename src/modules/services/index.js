module.exports = {
  // Exportar todas as partes do módulo de serviços
  ServiceRepository: require('./services.repository').ServiceRepository,
  ServiceService: require('./services.service').ServiceService,
  ServiceController: require('./services.controller').ServiceController,
  ServiceSchemas: require('./services.schemas').ServiceSchemas,
  ServiceRoutes: require('./services.routes')
};