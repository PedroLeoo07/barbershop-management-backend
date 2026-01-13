const { Pool } = require('pg');
const { AppError } = require('../errors/AppError');

// =====================================================
// CLASSE BASE PARA REPOSITÓRIOS COM TRANSAÇÕES
// =====================================================

class BaseRepository {
  constructor() {
    // Pool de conexões PostgreSQL
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'barbearia',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Log de inicialização
    console.log('✅ Database pool initialized');
  }

  // =====================================================
  // 🔄 MÉTODO PARA EXECUTAR TRANSAÇÕES
  // =====================================================

  async executeTransaction(callback) {
    const client = await this.pool.connect();
    
    try {
      // Iniciar transação
      await client.query('BEGIN');
      
      console.log('🔄 Transaction started');

      // Executar operações dentro da transação
      const result = await callback(client);
      
      // Confirmar transação
      await client.query('COMMIT');
      console.log('✅ Transaction committed');
      
      return result;

    } catch (error) {
      // Reverter transação em caso de erro
      await client.query('ROLLBACK');
      console.error('🔄 Transaction rolled back:', error.message);
      
      throw AppError.transactionError(error.message);
    } finally {
      // Liberar conexão
      client.release();
    }
  }

  // =====================================================
  // 📊 MÉTODOS DE CONSULTA BÁSICOS
  // =====================================================

  async query(text, params = []) {
    const start = Date.now();
    
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      console.log(`🔍 Query executed in ${duration}ms:`, {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        rows: result.rowCount,
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error) {
      console.error('🔥 Database query error:', {
        query: text,
        params,
        error: error.message
      });
      
      throw AppError.databaseError(`Query failed: ${error.message}`, error);
    }
  }

  async queryOne(text, params = []) {
    const result = await this.query(text, params);
    return result.rows[0] || null;
  }

  async queryMany(text, params = []) {
    const result = await this.query(text, params);
    return result.rows;
  }

  // =====================================================
  // 🔒 MÉTODOS COM LOCK PARA EVITAR CONCORRÊNCIA
  // =====================================================

  async queryWithLock(text, params = [], lockType = 'FOR UPDATE NOWAIT') {
    const fullQuery = `${text} ${lockType}`;
    return this.query(fullQuery, params);
  }

  async findByIdWithLock(tableName, id, lockType = 'FOR UPDATE NOWAIT') {
    const query = `SELECT * FROM ${tableName} WHERE id = $1 ${lockType}`;
    return this.queryOne(query, [id]);
  }

  // =====================================================
  // 📝 OPERAÇÕES CRUD BÁSICAS
  // =====================================================

  async findById(tableName, id) {
    const query = `SELECT * FROM ${tableName} WHERE id = $1`;
    return this.queryOne(query, [id]);
  }

  async findAll(tableName, conditions = {}, orderBy = 'id', order = 'ASC', limit = null, offset = null) {
    let query = `SELECT * FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    // Adicionar condições WHERE
    if (Object.keys(conditions).length > 0) {
      const whereClauses = [];
      for (const [field, value] of Object.entries(conditions)) {
        whereClauses.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    // Adicionar ORDER BY
    query += ` ORDER BY ${orderBy} ${order}`;

    // Adicionar LIMIT e OFFSET
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(limit);
      paramIndex++;
    }
    if (offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(offset);
    }

    return this.queryMany(query, params);
  }

  async create(tableName, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${tableName} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    return this.queryOne(query, values);
  }

  async update(tableName, id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`);

    const query = `
      UPDATE ${tableName}
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    return this.queryOne(query, [id, ...values]);
  }

  async delete(tableName, id) {
    const query = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
    return this.queryOne(query, [id]);
  }

  async softDelete(tableName, id) {
    const query = `
      UPDATE ${tableName}
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    return this.queryOne(query, [id]);
  }

  // =====================================================
  // 🔍 MÉTODOS DE BUSCA AVANÇADA
  // =====================================================

  async count(tableName, conditions = {}) {
    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereClauses = [];
      for (const [field, value] of Object.entries(conditions)) {
        whereClauses.push(`${field} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.queryOne(query, params);
    return parseInt(result.count);
  }

  async exists(tableName, conditions) {
    const count = await this.count(tableName, conditions);
    return count > 0;
  }

  async findBy(tableName, conditions, orderBy = 'id', order = 'ASC') {
    return this.findAll(tableName, conditions, orderBy, order);
  }

  async findOneBy(tableName, conditions) {
    const results = await this.findBy(tableName, conditions, 'id', 'ASC');
    return results[0] || null;
  }

  // =====================================================
  // 📊 MÉTODOS DE PAGINAÇÃO
  // =====================================================

  async paginate(tableName, page = 1, limit = 10, conditions = {}, orderBy = 'id', order = 'ASC') {
    const offset = (page - 1) * limit;
    
    // Buscar dados
    const data = await this.findAll(tableName, conditions, orderBy, order, limit, offset);
    
    // Contar total
    const total = await this.count(tableName, conditions);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  // =====================================================
  // 🔍 MÉTODOS DE BUSCA POR TEXTO
  // =====================================================

  async search(tableName, searchField, searchTerm, conditions = {}, limit = 50) {
    let query = `SELECT * FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    // Condições WHERE
    const whereClauses = [];

    // Adicionar busca por texto
    if (searchTerm && searchField) {
      whereClauses.push(`${searchField} ILIKE $${paramIndex}`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Adicionar outras condições
    for (const [field, value] of Object.entries(conditions)) {
      whereClauses.push(`${field} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY ${searchField} LIMIT $${paramIndex}`;
    params.push(limit);

    return this.queryMany(query, params);
  }

  // =====================================================
  // 📈 MÉTODOS DE AGREGAÇÃO
  // =====================================================

  async sum(tableName, field, conditions = {}) {
    let query = `SELECT SUM(${field}) as total FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereClauses = [];
      for (const [condField, value] of Object.entries(conditions)) {
        whereClauses.push(`${condField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.queryOne(query, params);
    return parseFloat(result.total || 0);
  }

  async avg(tableName, field, conditions = {}) {
    let query = `SELECT AVG(${field}) as average FROM ${tableName}`;
    const params = [];
    let paramIndex = 1;

    if (Object.keys(conditions).length > 0) {
      const whereClauses = [];
      for (const [condField, value] of Object.entries(conditions)) {
        whereClauses.push(`${condField} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.queryOne(query, params);
    return parseFloat(result.average || 0);
  }

  // =====================================================
  // 🛠️ MÉTODOS DE UTILIDADE
  // =====================================================

  async testConnection() {
    try {
      await this.query('SELECT 1');
      return { healthy: true, message: 'Database connection OK' };
    } catch (error) {
      return { healthy: false, message: error.message };
    }
  }

  async getTableSchema(tableName) {
    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `;
    return this.queryMany(query, [tableName]);
  }

  // =====================================================
  // 🔧 LIMPEZA DE RECURSOS
  // =====================================================

  async close() {
    await this.pool.end();
    console.log('🔌 Database pool closed');
  }
}

module.exports = { BaseRepository };