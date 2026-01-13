// =====================================================
// LOGGER ESTRUTURADO PARA O SISTEMA
// =====================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class Logger {
  static formatTimestamp() {
    return new Date().toISOString();
  }

  static formatMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    return logEntry;
  }

  static colorize(level, text) {
    const levelColors = {
      ERROR: colors.red,
      WARN: colors.yellow,
      INFO: colors.blue,
      DEBUG: colors.cyan,
      SUCCESS: colors.green
    };

    const color = levelColors[level.toUpperCase()] || colors.reset;
    return `${color}${text}${colors.reset}`;
  }

  static log(level, message, meta = {}) {
    const logEntry = this.formatMessage(level, message, meta);
    
    // Formato para console
    const consoleMessage = `[${logEntry.timestamp}] ${this.colorize(level, level.toUpperCase())}: ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
      console.log(consoleMessage, meta);
    } else {
      console.log(consoleMessage);
    }

    // Em produção, você pode adicionar aqui integrações com serviços de log
    // como Winston, Pino, ou enviar para serviços externos
    
    return logEntry;
  }

  static error(message, meta = {}) {
    return this.log('ERROR', message, meta);
  }

  static warn(message, meta = {}) {
    return this.log('WARN', message, meta);
  }

  static info(message, meta = {}) {
    return this.log('INFO', message, meta);
  }

  static debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      return this.log('DEBUG', message, meta);
    }
  }

  static success(message, meta = {}) {
    return this.log('SUCCESS', message, meta);
  }

  // Logs específicos do sistema
  static auth(action, userId, meta = {}) {
    return this.info(`Auth: ${action}`, {
      category: 'AUTH',
      userId,
      ...meta
    });
  }

  static appointment(action, appointmentId, userId, meta = {}) {
    return this.info(`Appointment: ${action}`, {
      category: 'APPOINTMENT',
      appointmentId,
      userId,
      ...meta
    });
  }

  static database(action, table, meta = {}) {
    return this.debug(`DB: ${action} on ${table}`, {
      category: 'DATABASE',
      table,
      ...meta
    });
  }

  static security(event, meta = {}) {
    return this.warn(`Security: ${event}`, {
      category: 'SECURITY',
      ...meta
    });
  }

  static performance(action, duration, meta = {}) {
    const level = duration > 1000 ? 'WARN' : 'DEBUG';
    return this.log(level, `Performance: ${action} took ${duration}ms`, {
      category: 'PERFORMANCE',
      duration,
      ...meta
    });
  }
}

module.exports = { Logger };