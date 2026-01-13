module.exports = {
  // Exportar todas as partes do módulo de barbeiros
  BarberRepository: require('./barbers.repository').BarberRepository,
  BarberService: require('./barbers.service').BarberService,
  BarberController: require('./barbers.controller').BarberController,
  BarberSchemas: require('./barbers.schemas').BarberSchemas,
  BarberRoutes: require('./barbers.routes')
};