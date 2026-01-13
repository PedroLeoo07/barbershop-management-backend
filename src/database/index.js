const { Pool } = require('pg');
const { config } = require('../config');

class Database {
  constructor() {
    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Configurar handlers de evento
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    this.pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });
  }

  // Método para obter o pool de conexões
  getPool() {
    return this.pool;
  }

  // Método para obter uma conexão específica
  async getClient() {
    return await this.pool.connect();
  }

  // Método para executar uma query
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (config.nodeEnv === 'development') {
        console.log('executed query', { text, duration, rows: res.rowCount });
      }
      
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Método para transações
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Método para fechar todas as conexões
  async close() {
    await this.pool.end();
    console.log('Database connection pool closed');
  }

  // Método para testar a conexão
  async testConnection() {
    try {
      const client = await this.getClient();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection test successful');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

// Exportar instância única (singleton)
const database = new Database();
module.exports = { database };