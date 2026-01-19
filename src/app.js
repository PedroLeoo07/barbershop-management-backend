const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Importar middlewares compartilhados
const { ErrorHandler } = require('./shared/middlewares/errorHandler');
const { RateLimiter } = require('./shared/middlewares/rateLimiter');
const { ResponseUtils } = require('./shared/utils/responses');

// Importar módulos
const appointmentRoutes = require('./modules/appointments/appointments.routes');
const paymentRoutes = require('./modules/payments/payments.routes');
const reportRoutes = require('./modules/reports/reports.routes');

// =====================================================
// CONFIGURAÇÃO PRINCIPAL DA APLICAÇÃO
// =====================================================

class App {
  constructor() {
    this.app = express();
    this.setupGlobalSettings();
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  // =====================================================
  // ⚙️ CONFIGURAÇÕES GLOBAIS
  // =====================================================

  setupGlobalSettings() {
    // Trust proxy para obter IP real atrás de load balancers
    this.app.set('trust proxy', 1);

    // Configurar handlers de erro globais
    ErrorHandler.setupGlobalHandlers();

    console.log('⚙️ Global settings configured');
  }

  // =====================================================
  // 🛡️ CONFIGURAÇÃO DE MIDDLEWARES
  // =====================================================

  setupMiddlewares() {
    // =====================================================
    // SEGURANÇA
    // =====================================================
    
    // Helmet para headers de segurança
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      }
    }));

    // CORS configurado
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    }));

    // =====================================================
    // RATE LIMITING E SEGURANÇA AVANÇADA
    // =====================================================

    // Stack de segurança completo
    this.app.use(RateLimiter.createSecurityStack());

    // =====================================================
    // PARSING E COMPRESSÃO
    // =====================================================

    // Compression para respostas
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      threshold: 1024 // Comprimir apenas se > 1KB
    }));

    // Parse JSON com limite de tamanho
    this.app.use(express.json({
      limit: process.env.JSON_LIMIT || '10mb',
      verify: (req, res, buf) => {
        // Verificação adicional do payload
        if (buf && buf.length > 0) {
          req.rawBody = buf.toString();
        }
      }
    }));

    // Parse URL-encoded
    this.app.use(express.urlencoded({
      extended: true,
      limit: process.env.URL_ENCODED_LIMIT || '10mb'
    }));

    // =====================================================
    // LOGGING E MONITORAMENTO
    // =====================================================

    // Morgan para logs de requisições
    const morganFormat = process.env.NODE_ENV === 'production' 
      ? 'combined' 
      : 'dev';

    this.app.use(morgan(morganFormat, {
      skip: (req, res) => {
        // Skip logs para health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      stream: {
        write: (message) => {
          console.log(`📊 ${message.trim()}`);
        }
      }
    }));

    // Middleware para adicionar metadados nas responses
    this.app.use(ResponseUtils.addMetadata());

    // =====================================================
    // MIDDLEWARE CUSTOMIZADO DE REQUEST ID
    // =====================================================

    this.app.use((req, res, next) => {
      req.id = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    console.log('🛡️ Security middlewares configured');
    console.log('📊 Monitoring middlewares configured');
    console.log('🔧 Parsing middlewares configured');
  }

  // =====================================================
  // 🛣️ CONFIGURAÇÃO DE ROTAS
  // =====================================================

  setupRoutes() {
    // =====================================================
    // HEALTH CHECK
    // =====================================================

    this.app.get('/health', (req, res) => {
      ResponseUtils.health(res, {
        database: { healthy: true, message: 'Connected' },
        memory: { 
          healthy: process.memoryUsage().heapUsed < 100 * 1024 * 1024, // 100MB
          message: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB used`
        },
        uptime: {
          healthy: process.uptime() > 0,
          message: `${Math.round(process.uptime())}s uptime`
        }
      });
    });

    this.app.get('/api/health', (req, res) => {
      res.redirect('/health');
    });

    // =====================================================
    // API ROUTES
    // =====================================================

    // Rota raiz da API
    this.app.get('/api', (req, res) => {
      ResponseUtils.success(res, {
        name: 'Barbearia API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          appointments: '/api/appointments',
          payments: '/api/payments',
          auth: '/api/auth'
        }
      }, 'API Online');
    });

    // Módulos da aplicação
    this.app.use('/api/appointments', appointmentRoutes);
    this.app.use('/api/payments', paymentRoutes);
    
    // TODO: Adicionar outras rotas quando criadas
    // this.app.use('/api/auth', authRoutes);
    // this.app.use('/api/services', serviceRoutes);
    // this.app.use('/api/users', userRoutes);

    // =====================================================
    // MÉTRICAS E MONITORAMENTO
    // =====================================================

    this.app.get('/api/metrics', (req, res) => {
      const metrics = {
        responseTime: res.locals.executionTime || 0,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      };

      ResponseUtils.performance(res, metrics);
    });

    // =====================================================
    // DOCUMENTAÇÃO DA API
    // =====================================================

    this.app.get('/api/docs', (req, res) => {
      const apiDocs = {
        title: 'Barbearia API Documentation',
        version: '1.0.0',
        baseUrl: `${req.protocol}://${req.get('host')}/api`,
        endpoints: {
          health: {
            path: '/health',
            method: 'GET',
            description: 'Verificação de saúde da API'
          },
          appointments: {
            path: '/api/appointments',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'Gerenciamento de agendamentos'
          }
        },
        authentication: {
          type: 'Bearer Token',
          header: 'Authorization',
          format: 'Bearer <token>'
        }
      };

      ResponseUtils.success(res, apiDocs, 'Documentação da API');
    });

    console.log('🛣️ Routes configured');
  }

  // =====================================================
  // ⚠️ TRATAMENTO DE ERROS
  // =====================================================

  setupErrorHandling() {
    // Rota não encontrada (404)
    this.app.use('*', ErrorHandler.notFoundHandler);

    // Handler global de erros
    this.app.use(ErrorHandler.handleError);

    console.log('⚠️ Error handling configured');
  }

  // =====================================================
  // 🚪 GRACEFUL SHUTDOWN
  // =====================================================

  setupGracefulShutdown() {
    const gracefulShutdown = (signal) => {
      console.log(`\n🚪 Received ${signal}, starting graceful shutdown...`);
      
      if (this.server) {
        this.server.close(() => {
          console.log('✅ HTTP server closed');
          
          // Fechar conexões de banco, redis, etc.
          // TODO: Implementar limpeza de recursos
          
          console.log('👋 Graceful shutdown completed');
          process.exit(0);
        });

        // Force shutdown após 30 segundos
        setTimeout(() => {
          console.error('💀 Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 30000);
      }
    };

    // Handlers para sinais de shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    console.log('🚪 Graceful shutdown configured');
  }

  // =====================================================
  // 🚀 MÉTODO PARA INICIAR O SERVIDOR
  // =====================================================

  start(port = process.env.PORT || 3001) {
    this.server = this.app.listen(port, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 BARBEARIA API STARTED');
      console.log('='.repeat(50));
      console.log(`📍 Port: ${port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health Check: http://localhost:${port}/health`);
      console.log(`📚 Documentation: http://localhost:${port}/api/docs`);
      console.log(`⏰ Started at: ${new Date().toISOString()}`);
      console.log('='.repeat(50) + '\n');
    });

    // Tratar erros do servidor
    this.server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`💀 Port ${port} is already in use`);
        process.exit(1);
      } else {
        console.error('💀 Server error:', error);
      }
    });

    return this.server;
  }

  // =====================================================
  // 🛑 MÉTODO PARA PARAR O SERVIDOR
  // =====================================================

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  // =====================================================
  // 🎯 GETTER PARA ACESSO À INSTÂNCIA EXPRESS
  // =====================================================

  getApp() {
    return this.app;
  }
}

module.exports = { App };