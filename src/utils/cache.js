// =====================================================
// SISTEMA DE CACHE AVANÇADO
// =====================================================

const { Logger } = require('./Logger');

/**
 * Sistema de cache em memória com TTL e estratégias de invalidação
 */
class CacheManager {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttlMap = new Map();
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutos
    this.maxSize = options.maxSize || 1000;
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minuto
    this.enabled = options.enabled !== false;

    // Inicia limpeza automática
    if (this.enabled) {
      this.startCleanupProcess();
    }

    Logger.database('Cache manager initialized', {
      defaultTTL: this.defaultTTL,
      maxSize: this.maxSize,
      enabled: this.enabled
    });
  }

  /**
   * Define um valor no cache
   */
  set(key, value, ttl = null) {
    if (!this.enabled) return;

    try {
      // Remove itens expirados se necessário
      this.ensureCapacity();

      const expiresAt = Date.now() + (ttl || this.defaultTTL);
      
      this.cache.set(key, {
        value,
        createdAt: Date.now(),
        expiresAt,
        hits: 0
      });

      this.ttlMap.set(key, expiresAt);

      Logger.database('Cache SET', { key, ttl: ttl || this.defaultTTL });
    } catch (error) {
      Logger.error('Cache SET error', { key, error });
    }
  }

  /**
   * Obtém um valor do cache
   */
  get(key) {
    if (!this.enabled) return null;

    try {
      const item = this.cache.get(key);
      
      if (!item) {
        Logger.database('Cache MISS', { key });
        return null;
      }

      // Verifica se expirou
      if (this.isExpired(key)) {
        this.delete(key);
        Logger.database('Cache EXPIRED', { key });
        return null;
      }

      // Incrementa contador de hits
      item.hits++;
      
      Logger.database('Cache HIT', { key, hits: item.hits });
      return item.value;
    } catch (error) {
      Logger.error('Cache GET error', { key, error });
      return null;
    }
  }

  /**
   * Remove um item do cache
   */
  delete(key) {
    if (!this.enabled) return;

    try {
      const deleted = this.cache.delete(key);
      this.ttlMap.delete(key);
      
      if (deleted) {
        Logger.database('Cache DELETE', { key });
      }
      
      return deleted;
    } catch (error) {
      Logger.error('Cache DELETE error', { key, error });
      return false;
    }
  }

  /**
   * Verifica se uma chave existe e não expirou
   */
  has(key) {
    if (!this.enabled) return false;

    if (!this.cache.has(key)) {
      return false;
    }

    if (this.isExpired(key)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    if (!this.enabled) return;

    const size = this.cache.size;
    this.cache.clear();
    this.ttlMap.clear();
    
    Logger.database('Cache CLEAR', { itemsCleared: size });
  }

  /**
   * Invalida cache por padrão de chave
   */
  invalidatePattern(pattern) {
    if (!this.enabled) return;

    const regex = new RegExp(pattern);
    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }

    Logger.database('Cache INVALIDATE PATTERN', { pattern, invalidated });
    return invalidated;
  }

  /**
   * Invalida cache por tags/prefixos
   */
  invalidateByPrefix(prefix) {
    if (!this.enabled) return;

    let invalidated = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.delete(key);
        invalidated++;
      }
    }

    Logger.database('Cache INVALIDATE PREFIX', { prefix, invalidated });
    return invalidated;
  }

  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    if (!this.enabled) {
      return { enabled: false };
    }

    const now = Date.now();
    let totalHits = 0;
    let expiredItems = 0;

    for (const [key, item] of this.cache.entries()) {
      totalHits += item.hits;
      
      if (this.isExpired(key)) {
        expiredItems++;
      }
    }

    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      expiredItems,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Wrapper para funções com cache automático
   */
  async wrap(key, fn, ttl = null) {
    if (!this.enabled) {
      return await fn();
    }

    // Tenta buscar no cache primeiro
    let cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Executa a função e salva no cache
    try {
      const result = await fn();
      this.set(key, result, ttl);
      return result;
    } catch (error) {
      Logger.error('Cache WRAP error', { key, error });
      throw error;
    }
  }

  // =====================================================
  // MÉTODOS PRIVADOS
  // =====================================================

  isExpired(key) {
    const expiresAt = this.ttlMap.get(key);
    return expiresAt && Date.now() > expiresAt;
  }

  ensureCapacity() {
    if (this.cache.size >= this.maxSize) {
      // Remove os itens mais antigos ou menos usados
      this.evictItems(Math.floor(this.maxSize * 0.1)); // Remove 10%
    }
  }

  evictItems(count) {
    const items = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => {
        // Prioriza itens expirados, depois por número de hits e idade
        if (this.isExpired(a.key) && !this.isExpired(b.key)) return -1;
        if (!this.isExpired(a.key) && this.isExpired(b.key)) return 1;
        if (a.hits !== b.hits) return a.hits - b.hits;
        return a.createdAt - b.createdAt;
      });

    for (let i = 0; i < Math.min(count, items.length); i++) {
      this.delete(items[i].key);
    }

    Logger.database('Cache EVICT', { evicted: Math.min(count, items.length) });
  }

  startCleanupProcess() {
    setInterval(() => {
      this.cleanupExpiredItems();
    }, this.cleanupInterval);
  }

  cleanupExpiredItems() {
    let cleaned = 0;

    for (const key of this.cache.keys()) {
      if (this.isExpired(key)) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.database('Cache CLEANUP', { cleaned });
    }
  }

  estimateMemoryUsage() {
    let size = 0;
    
    for (const [key, item] of this.cache.entries()) {
      size += this.getObjectSize(key) + this.getObjectSize(item);
    }
    
    return size;
  }

  getObjectSize(obj) {
    // Estimativa simples do tamanho do objeto
    return JSON.stringify(obj).length * 2; // Aprox. 2 bytes por char
  }
}

// =====================================================
// CACHE ESPECÍFICO PARA APLICAÇÃO
// =====================================================

class BarbershopCache extends CacheManager {
  constructor(options = {}) {
    super({
      defaultTTL: 300000, // 5 minutos
      maxSize: 1000,
      ...options
    });

    // TTLs específicos por tipo de dados
    this.ttls = {
      user: 600000,      // 10 minutos
      barber: 600000,    // 10 minutos  
      service: 1800000,  // 30 minutos (muda menos)
      appointment: 60000, // 1 minuto (muda frequentemente)
      schedule: 300000,  // 5 minutos
      statistics: 900000 // 15 minutos
    };
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS PARA ENTIDADES
  // =====================================================

  setUser(userId, userData) {
    this.set(`user:${userId}`, userData, this.ttls.user);
  }

  getUser(userId) {
    return this.get(`user:${userId}`);
  }

  setBarber(barberId, barberData) {
    this.set(`barber:${barberId}`, barberData, this.ttls.barber);
  }

  getBarber(barberId) {
    return this.get(`barber:${barberId}`);
  }

  setService(serviceId, serviceData) {
    this.set(`service:${serviceId}`, serviceData, this.ttls.service);
  }

  getService(serviceId) {
    return this.get(`service:${serviceId}`);
  }

  setAppointment(appointmentId, appointmentData) {
    this.set(`appointment:${appointmentId}`, appointmentData, this.ttls.appointment);
  }

  getAppointment(appointmentId) {
    return this.get(`appointment:${appointmentId}`);
  }

  setSchedule(barberId, date, schedule) {
    this.set(`schedule:${barberId}:${date}`, schedule, this.ttls.schedule);
  }

  getSchedule(barberId, date) {
    return this.get(`schedule:${barberId}:${date}`);
  }

  setStatistics(key, stats) {
    this.set(`stats:${key}`, stats, this.ttls.statistics);
  }

  getStatistics(key) {
    return this.get(`stats:${key}`);
  }

  // =====================================================
  // INVALIDAÇÃO ESPECÍFICA
  // =====================================================

  invalidateUser(userId) {
    this.delete(`user:${userId}`);
    // Invalida caches relacionados
    this.invalidateByPrefix(`appointment:client:${userId}`);
    this.invalidateByPrefix(`appointment:barber:${userId}`);
  }

  invalidateBarber(barberId) {
    this.delete(`barber:${barberId}`);
    this.invalidateByPrefix(`schedule:${barberId}`);
    this.invalidateByPrefix(`appointment:barber:${barberId}`);
  }

  invalidateService(serviceId) {
    this.delete(`service:${serviceId}`);
    this.invalidateByPrefix('schedule:'); // Todos os horários podem ter mudado
  }

  invalidateAppointment(appointmentId, barberId = null, date = null) {
    this.delete(`appointment:${appointmentId}`);
    
    if (barberId && date) {
      this.delete(`schedule:${barberId}:${date}`);
    }
    
    // Invalida estatísticas
    this.invalidateByPrefix('stats:');
  }

  invalidateAllSchedules() {
    this.invalidateByPrefix('schedule:');
  }

  invalidateAllStatistics() {
    this.invalidateByPrefix('stats:');
  }
}

// Instância global do cache
const cache = new BarbershopCache();

module.exports = {
  CacheManager,
  BarbershopCache,
  cache
};