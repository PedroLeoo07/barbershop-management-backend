import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Configuração do ambiente
dotenv.config();

import { config } from './config';
import { database } from './database';
import { apiRoutes } from './routes';
import {
  generalRateLimit,
  errorHandler,
  notFoundHandler,
  requestLogger,
  sanitizeInput,
  securityHeaders
} from './middlewares/security';

class App {
  public express: Express;

  constructor() {
    this.express = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    // Middleware de segurança
    this.express.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.express.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'Pragma'
      ],
    }));

    // Rate limiting
    this.express.use(generalRateLimit);

    // Body parsing
    this.express.use(express.json({ limit: '10mb' }));
    this.express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging
    if (config.nodeEnv === 'development') {
      this.express.use(morgan('dev'));
    } else {
      this.express.use(morgan('combined'));
    }

    // Custom middlewares
    this.express.use(requestLogger);
    this.express.use(sanitizeInput);
    this.express.use(securityHeaders);

    // Trust proxy (para Heroku, AWS, etc.)
    this.express.set('trust proxy', 1);
  }

  private initializeRoutes(): void {
    // Rota raiz
    this.express.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'Sistema de Gestão de Barbearia - API',
        version: '1.0.0',
        documentation: '/api/info',
        health: '/api/health',
        timestamp: new Date().toISOString(),
      });
    });

    // Rotas da API
    this.express.use('/api', apiRoutes);
  }

  private initializeErrorHandling(): void {
    // 404 handler
    this.express.use(notFoundHandler);

    // Error handler global
    this.express.use(errorHandler);
  }

  public async start(): Promise<void> {
    try {
      // Testar conexão com banco de dados
      const dbConnected = await database.testConnection();
      if (!dbConnected) {
        throw new Error('Falha na conexão com o banco de dados');
      }

      // Iniciar servidor
      this.express.listen(config.port, () => {
        console.log('\n🚀 ================================');
        console.log('🎯 BARBEARIA BACKEND INICIADO!');
        console.log('🚀 ================================');
        console.log(`🌐 Servidor: http://localhost:${config.port}`);
        console.log(`📱 API: http://localhost:${config.port}/api`);
        console.log(`🔍 Health: http://localhost:${config.port}/api/health`);
        console.log(`📚 Info: http://localhost:${config.port}/api/info`);
        console.log(`🔒 Ambiente: ${config.nodeEnv}`);
        console.log(`💾 Banco: PostgreSQL (${config.database.host}:${config.database.port})`);
        console.log('🚀 ================================\n');

        if (config.nodeEnv === 'development') {
          console.log('💡 Comandos úteis:');
          console.log('   npm run migration  - Executar migrations');
          console.log('   npm run seed       - Executar seeds');
          console.log('   npm run dev        - Modo desenvolvimento');
          console.log('   npm run build      - Compilar TypeScript\n');
        }
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Erro ao iniciar servidor:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📴 Recebido sinal ${signal}. Encerrando servidor...`);
      
      try {
        // Fechar conexões do banco
        await database.close();
        console.log('✅ Conexões do banco fechadas');
        
        console.log('✅ Servidor encerrado com segurança');
        process.exit(0);
      } catch (error) {
        console.error('❌ Erro durante o encerramento:', error);
        process.exit(1);
      }
    };

    // Capturar sinais de encerramento
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Capturar erros não tratados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception thrown:', error);
      process.exit(1);
    });
  }
}

// Criar e iniciar aplicação
const app = new App();

// Exportar para uso em testes
export { app };

// Iniciar servidor se não estiver em modo de teste
if (require.main === module) {
  app.start();
}