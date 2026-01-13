const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { AppError } = require('../errors/AppError');

// =====================================================
// CONFIGURAÇÕES DE RATE LIMITING PROFISSIONAL
// =====================================================

class RateLimiter {
  // =====================================================
  // 🛡️ RATE LIMITER GERAL
  // =====================================================

  static general() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100, // limite de 100 requests por window
      message: {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas. Tente novamente em 15 minutos.',
        retryAfter: 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting para health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      keyGenerator: (req) => {
        // Usar IP + User ID se autenticado
        return req.user?.id ? `${req.ip}-${req.user.id}` : req.ip;
      },
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Rate limit exceeded for IP: ${req.ip}, User: ${req.user?.id || 'anonymous'}`);
      }
    });
  }

  // =====================================================
  // 🔐 RATE LIMITER PARA AUTENTICAÇÃO
  // =====================================================

  static auth() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 5, // apenas 5 tentativas de login por IP
      message: {
        success: false,
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        retryAfter: 15 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true, // não contar requests bem-sucedidos
      skipFailedRequests: false,    // contar requests que falharam
      keyGenerator: (req) => req.ip,
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Auth rate limit exceeded for IP: ${req.ip}`);
        
        // Log tentativa suspeita
        console.warn('Suspicious login activity detected:', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          email: req.body?.email,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // =====================================================
  // 📱 RATE LIMITER PARA CRIAÇÃO DE AGENDAMENTOS
  // =====================================================

  static appointments() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 3, // máximo 3 agendamentos por minuto
      message: {
        success: false,
        error: 'APPOINTMENT_RATE_LIMIT_EXCEEDED',
        message: 'Muitos agendamentos em pouco tempo. Aguarde 1 minuto.',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Rate limit por usuário autenticado
        return req.user?.id || req.ip;
      },
      skip: (req) => {
        // Admins podem fazer mais agendamentos
        return req.user?.role === 'admin';
      },
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Appointment rate limit exceeded for User: ${req.user?.id || 'anonymous'}`);
      }
    });
  }

  // =====================================================
  // 🔄 RATE LIMITER PARA UPDATES/DELETES
  // =====================================================

  static modifications() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 10, // máximo 10 modificações por minuto
      message: {
        success: false,
        error: 'MODIFICATION_RATE_LIMIT_EXCEEDED',
        message: 'Muitas modificações em pouco tempo. Aguarde um momento.',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Modification rate limit exceeded for User: ${req.user?.id || 'anonymous'}`);
      }
    });
  }

  // =====================================================
  // 📊 RATE LIMITER PARA CONSULTAS PESADAS
  // =====================================================

  static reporting() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 5, // máximo 5 consultas pesadas por minuto
      message: {
        success: false,
        error: 'REPORTING_RATE_LIMIT_EXCEEDED',
        message: 'Muitas consultas de relatório. Aguarde um momento.',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Reporting rate limit exceeded for User: ${req.user?.id || 'anonymous'}`);
      }
    });
  }

  // =====================================================
  // ⚡ SLOW DOWN MIDDLEWARE (Degradação Gradual)
  // =====================================================

  static slowDown() {
    return slowDown({
      windowMs: 15 * 60 * 1000, // 15 minutos
      delayAfter: 50, // começar delay após 50 requests
      delayMs: 500, // aumentar 500ms a cada request
      maxDelayMs: 20000, // delay máximo de 20 segundos
      keyGenerator: (req) => req.user?.id || req.ip,
      skip: (req) => {
        // Skip para health checks
        return req.path === '/health' || req.path === '/api/health';
      },
      onLimitReached: (req, res, options) => {
        console.warn(`🐌 Slow down activated for IP: ${req.ip}, User: ${req.user?.id || 'anonymous'}`);
      }
    });
  }

  // =====================================================
  // 🔒 RATE LIMITER PARA RESET DE SENHA
  // =====================================================

  static passwordReset() {
    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hora
      max: 3, // máximo 3 tentativas de reset por hora
      message: {
        success: false,
        error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        message: 'Muitas tentativas de reset de senha. Tente novamente em 1 hora.',
        retryAfter: 60 * 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        // Rate limit por email + IP
        const email = req.body?.email || 'unknown';
        return `${req.ip}-${email}`;
      },
      onLimitReached: (req, res, options) => {
        console.warn(`🚨 Password reset rate limit exceeded:`, {
          ip: req.ip,
          email: req.body?.email,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // =====================================================
  // 🎯 RATE LIMITER PARA APIs ESPECÍFICAS
  // =====================================================

  static search() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 30, // máximo 30 pesquisas por minuto
      message: {
        success: false,
        error: 'SEARCH_RATE_LIMIT_EXCEEDED',
        message: 'Muitas pesquisas em pouco tempo. Aguarde um momento.',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip
    });
  }

  static dashboard() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minuto
      max: 20, // máximo 20 carregamentos de dashboard por minuto
      message: {
        success: false,
        error: 'DASHBOARD_RATE_LIMIT_EXCEEDED',
        message: 'Muitas atualizações do dashboard. Aguarde um momento.',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip
    });
  }

  // =====================================================
  // 🛠️ CONFIGURAÇÕES AVANÇADAS
  // =====================================================

  static createCustom(options) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      message: {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas requisições. Tente novamente mais tarde.'
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  // =====================================================
  // 📊 MIDDLEWARE DE MONITORAMENTO
  // =====================================================

  static monitor() {
    return (req, res, next) => {
      const start = Date.now();

      // Override do res.json para capturar métricas
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - start;
        
        // Log de métricas
        console.log(`📊 Request metrics:`, {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          userId: req.user?.id,
          timestamp: new Date().toISOString()
        });

        return originalJson.call(this, data);
      };

      next();
    };
  }

  // =====================================================
  // 🔥 DETECTOR DE ATAQUES AUTOMATIZADO
  // =====================================================

  static attackDetector() {
    const suspiciousIPs = new Map();
    const SUSPICIOUS_THRESHOLD = 50; // requests em 1 minuto
    const BAN_DURATION = 24 * 60 * 60 * 1000; // 24 horas

    return (req, res, next) => {
      const ip = req.ip;
      const now = Date.now();

      // Limpar IPs antigos
      for (const [suspiciousIP, data] of suspiciousIPs.entries()) {
        if (now - data.firstSeen > 60 * 1000) {
          suspiciousIPs.delete(suspiciousIP);
        }
      }

      // Verificar se IP está banido
      const ipData = suspiciousIPs.get(ip);
      if (ipData && ipData.banned && (now - ipData.bannedAt < BAN_DURATION)) {
        return res.status(403).json({
          success: false,
          error: 'IP_BANNED',
          message: 'IP temporariamente banido por atividade suspeita.',
          bannedUntil: new Date(ipData.bannedAt + BAN_DURATION).toISOString()
        });
      }

      // Contar requisições
      if (ipData) {
        ipData.count++;
        if (ipData.count > SUSPICIOUS_THRESHOLD && !ipData.banned) {
          ipData.banned = true;
          ipData.bannedAt = now;
          
          console.error(`🚨 IP BANNED for suspicious activity: ${ip}`, {
            requests: ipData.count,
            timeWindow: '1 minute',
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          });

          return res.status(403).json({
            success: false,
            error: 'SUSPICIOUS_ACTIVITY',
            message: 'Atividade suspeita detectada. IP temporariamente banido.'
          });
        }
      } else {
        suspiciousIPs.set(ip, {
          count: 1,
          firstSeen: now,
          banned: false
        });
      }

      next();
    };
  }

  // =====================================================
  // 🎛️ MIDDLEWARE COMPOSTO
  // =====================================================

  static createSecurityStack() {
    return [
      RateLimiter.attackDetector(),
      RateLimiter.slowDown(),
      RateLimiter.general(),
      RateLimiter.monitor()
    ];
  }
}

module.exports = { RateLimiter };