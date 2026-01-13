// =====================================================
// INTERFACE BASE PARA REPOSITORIES
// =====================================================

const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

/**
 * Classe base abstrata para todos os repositories
 * Fornece funcionalidades comuns como transações, cache, validações
 */
class BaseRepository {
  constructor(db) {
    if (new.target === BaseRepository) {
      throw new Error('BaseRepository não pode ser instanciado diretamente');
    }
    
    this.db = db;
    this.tableName = null; // Deve ser definido nas classes filhas
    this.cache = new Map(); // Cache simples em memória
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  // =====================================================
  // GERENCIAMENTO DE TRANSAÇÕES
  // =====================================================

  /**
   * Executa uma operação dentro de uma transação
   */
  async withTransaction(operation) {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await operation(client);
      
      await client.query('COMMIT');
      this.invalidateCache(); // Limpa cache após mudanças
      
      Logger.database('Transaction committed successfully', {
        table: this.tableName
      });
      
      return result;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      Logger.error('Transaction rolled back', {
        error: error.message,
        table: this.tableName
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Executa múltiplas operações em uma única transação
   */
  async withBatchTransaction(operations) {
    const client = await this.db.connect();
    const results = [];
    
    try {
      await client.query('BEGIN');
      
      for (const operation of operations) {
        const result = await operation(client);
        results.push(result);
      }
      
      await client.query('COMMIT');
      this.invalidateCache();
      
      Logger.database('Batch transaction committed', {
        operationsCount: operations.length,
        table: this.tableName
      });
      
      return results;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      Logger.error('Batch transaction rolled back', {
        error: error.message,
        operationsCount: operations.length,
        table: this.tableName
      });
      
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // OPERAÇÕES CRUD BÁSICAS
  // =====================================================

  /**
   * Busca um registro por ID
   */
  async findById(id, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    // Verifica cache primeiro
    const cacheKey = `${this.tableName}_${id}`;
    const cached = this.getFromCache(cacheKey);
    if (cached && !client) {
      return cached;
    }

    const queryClient = client || this.db;
    
    const result = await queryClient.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );

    const record = result.rows[0] || null;
    
    // Salva no cache se não estiver em transação
    if (record && !client) {
      this.setCache(cacheKey, record);
    }

    return record;
  }

  /**
   * Busca múltiplos registros com filtros
   */
  async findMany(filters = {}, options = {}, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    const {
      limit = 50,
      offset = 0,
      orderBy = 'id',
      orderDirection = 'ASC',
      includeInactive = false
    } = options;

    let query = `SELECT * FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    // Adiciona filtros
    let paramCount = 0;
    for (const [key, value] of Object.entries(filters)) {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      params.push(value);
    }

    // Filtro padrão para registros ativos (se a tabela tiver is_active)
    if (!includeInactive && await this.hasColumn('is_active')) {
      paramCount++;
      conditions.push(`is_active = $${paramCount}`);
      params.push(true);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Ordenação e paginação
    query += ` ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const queryClient = client || this.db;
    const result = await queryClient.query(query, params);

    return result.rows;
  }

  /**
   * Cria um novo registro
   */
  async create(data, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const queryClient = client || this.db;
    const result = await queryClient.query(query, values);
    
    const created = result.rows[0];
    this.invalidateCache(); // Limpa cache após criação

    Logger.database('Record created', {
      table: this.tableName,
      id: created.id
    });

    return created;
  }

  /**
   * Atualiza um registro por ID
   */
  async update(id, data, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    // Remove campos que não devem ser atualizados
    const updateData = { ...data };
    delete updateData.id;
    delete updateData.created_at;

    const columns = Object.keys(updateData);
    const values = Object.values(updateData);

    if (columns.length === 0) {
      throw AppError.badRequest('Nenhum campo para atualizar');
    }

    const setClause = columns.map((col, index) => `${col} = $${index + 2}`);

    // Adiciona updated_at se a coluna existir
    if (await this.hasColumn('updated_at')) {
      setClause.push('updated_at = NOW()');
    }

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const queryClient = client || this.db;
    const result = await queryClient.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      throw AppError.notFound(`Registro não encontrado na tabela ${this.tableName}`);
    }

    this.invalidateCache();

    Logger.database('Record updated', {
      table: this.tableName,
      id
    });

    return result.rows[0];
  }

  /**
   * Remove um registro por ID (soft delete se possível)
   */
  async delete(id, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    const queryClient = client || this.db;

    // Verifica se o registro existe
    const existing = await this.findById(id, queryClient);
    if (!existing) {
      throw AppError.notFound(`Registro não encontrado na tabela ${this.tableName}`);
    }

    let query;
    let params;

    // Soft delete se a coluna is_active existir
    if (await this.hasColumn('is_active')) {
      const setClause = ['is_active = $2'];
      
      if (await this.hasColumn('updated_at')) {
        setClause.push('updated_at = NOW()');
      }

      query = `
        UPDATE ${this.tableName}
        SET ${setClause.join(', ')}
        WHERE id = $1
        RETURNING *
      `;
      params = [id, false];
    } else {
      // Hard delete
      query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
      params = [id];
    }

    const result = await queryClient.query(query, params);
    this.invalidateCache();

    Logger.database('Record deleted', {
      table: this.tableName,
      id,
      softDelete: await this.hasColumn('is_active')
    });

    return result.rows[0];
  }

  // =====================================================
  // MÉTODOS DE CACHE
  // =====================================================

  getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    if (cached) {
      this.cache.delete(key);
    }

    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidateCache() {
    this.cache.clear();
  }

  // =====================================================
  // MÉTODOS AUXILIARES
  // =====================================================

  /**
   * Verifica se uma coluna existe na tabela
   */
  async hasColumn(columnName) {
    try {
      const result = await this.db.query(
        `SELECT 1 FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = $2`,
        [this.tableName, columnName]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Conta o número total de registros com filtros
   */
  async count(filters = {}, includeInactive = false, client = null) {
    if (!this.tableName) {
      throw new Error('tableName deve ser definido na classe filha');
    }

    let query = `SELECT COUNT(*) FROM ${this.tableName}`;
    const params = [];
    const conditions = [];

    let paramCount = 0;
    for (const [key, value] of Object.entries(filters)) {
      paramCount++;
      conditions.push(`${key} = $${paramCount}`);
      params.push(value);
    }

    if (!includeInactive && await this.hasColumn('is_active')) {
      paramCount++;
      conditions.push(`is_active = $${paramCount}`);
      params.push(true);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const queryClient = client || this.db;
    const result = await queryClient.query(query, params);

    return parseInt(result.rows[0].count);
  }

  /**
   * Busca registros com paginação e metadados
   */
  async paginate(filters = {}, page = 1, limit = 20, options = {}) {
    const offset = (page - 1) * limit;
    
    const [records, total] = await Promise.all([
      this.findMany(filters, { ...options, limit, offset }),
      this.count(filters, options.includeInactive)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }
}

module.exports = { BaseRepository };