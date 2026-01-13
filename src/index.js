require('dotenv').config();
const { App } = require('./app');

// =====================================================
// 🚀 PONTO DE ENTRADA DA APLICAÇÃO
// =====================================================

async function startServer() {
  try {
    // Verificar variáveis de ambiente essenciais
    const requiredEnvVars = [
      'JWT_SECRET',
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('💀 Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('\nPlease check your .env file\n');
      process.exit(1);
    }

    // Criar e iniciar aplicação
    const app = new App();
    const port = process.env.PORT || 3001;
    
    // Iniciar servidor
    app.start(port);

  } catch (error) {
    console.error('💀 Failed to start server:', error);
    process.exit(1);
  }
}

// =====================================================
// 🎬 INICIAR APLICAÇÃO
// =====================================================

if (require.main === module) {
  startServer();
}

module.exports = { startServer };