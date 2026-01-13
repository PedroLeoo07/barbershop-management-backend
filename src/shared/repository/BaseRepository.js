// =====================================================
// BASE REPOSITORY COM TRANSAÇÕES PROFISSIONAL
// =====================================================

const { Logger } = require('../utils/Logger');
const { AppError } = require('../errors/AppError');

class BaseRepository {
  constructor(pool) {
    this.pool = pool;
    this.tableName = null; // Deve ser definido pelas classes filhas
  }

  // =====================================================
  // 🔒 TRANSAÇÕES SEGURAS
  // =====================================================

  async withTransaction(callback) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      Logger.database('Transaction started', { table: this.tableName });

      const result = await callback(client);
      
      await client.query('COMMIT');
      Logger.database('Transaction committed', { table: this.tableName });

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.database('Transaction rolled back', { 
        table: this.tableName, 
        error: error.message 
      });

      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // 📊 OPERAÇÕES CRUD BÁSICAS
  // =====================================================

  async findById(id, client = null) {
    try {
      const queryClient = client || this.pool;
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      
      const result = await queryClient.query(query, [id]);
      
      Logger.database('Record found by ID', { 
        table: this.tableName, 
        id,
        found: result.rows.length > 0 
      });

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      Logger.database('Error finding record by ID', { 
        table: this.tableName, 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  async findAll(filters = {}, pagination = null, client = null) {
    try {
      const queryClient = client || this.pool;
      
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params = [];
      let paramCount = 0;

      // Aplica filtros dinamicamente
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.push(filters[key]);
          query += ` AND ${key} = $${++paramCount}`;
        }
      });

      // Adiciona ordenação padrão
      query += ` ORDER BY created_at DESC`;

      // Adiciona paginação se fornecida
      if (pagination) {
        const { limit, offset } = pagination;
        params.push(limit, offset);
        query += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      }

      const result = await queryClient.query(query, params);
      
      Logger.database('Records found', { 
        table: this.tableName, 
        filters, 
        count: result.rows.length 
      });

      return result.rows;
    } catch (error) {
      Logger.database('Error finding records', { 
        table: this.tableName, 
        filters, 
        error: error.message 
      });
      throw error;
    }
  }

  async create(data, client = null) {
    try {
      const queryClient = client || this.pool;
      
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map((_, index) => `$${index + 1}`);

      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;

      const result = await queryClient.query(query, values);
      
      Logger.database('Record created', { 
        table: this.tableName, 
        id: result.rows[0].id 
      });

      return result.rows[0];
    } catch (error) {
      Logger.database('Error creating record', { 
        table: this.tableName, 
        data, 
        error: error.message 
      });
      throw error;
    }
  }

  async update(id, data, client = null) {
    try {
      const queryClient = client || this.pool;
      
      const fields = Object.keys(data);
      const values = Object.values(data);
      
      if (fields.length === 0) {
        throw new AppError('Nenhum campo para atualizar', 400);
      }

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`);
      
      const query = `
        UPDATE ${this.tableName}
        SET ${setClause.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await queryClient.query(query, [id, ...values]);
      
      if (result.rows.length === 0) {
        throw new AppError('Registro não encontrado', 404);
      }

      Logger.database('Record updated', { 
        table: this.tableName, 
        id 
      });

      return result.rows[0];
    } catch (error) {
      Logger.database('Error updating record', { 
        table: this.tableName, 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  async delete(id, client = null) {
    try {
      const queryClient = client || this.pool;
      
      const query = `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`;
      const result = await queryClient.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Registro não encontrado', 404);
      }

      Logger.database('Record deleted', { 
        table: this.tableName, 
        id 
      });

      return result.rows[0];
    } catch (error) {
      Logger.database('Error deleting record', { 
        table: this.tableName, 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  // =====================================================
  // 🗑️ SOFT DELETE
  // =====================================================

  async softDelete(id, client = null) {
    try {
      const queryClient = client || this.pool;
      
      const query = `
        UPDATE ${this.tableName}
        SET is_active = false, deleted_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING *
      `;

      const result = await queryClient.query(query, [id]);
      
      if (result.rows.length === 0) {
        throw new AppError('Registro não encontrado ou já desativado', 404);
      }

      Logger.database('Record soft deleted', { 
        table: this.tableName, 
        id 
      });

      return result.rows[0];
    } catch (error) {
      Logger.database('Error soft deleting record', { 
        table: this.tableName, 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  // =====================================================
  // 📊 OPERAÇÕES DE CONTAGEM
  // =====================================================

  async count(filters = {}, client = null) {
    try {
      const queryClient = client || this.pool;
      
      let query = `SELECT COUNT(*) FROM ${this.tableName} WHERE 1=1`;
      const params = [];
      let paramCount = 0;

      // Aplica filtros dinamicamente
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.push(filters[key]);
          query += ` AND ${key} = $${++paramCount}`;
        }
      });

      const result = await queryClient.query(query, params);
      
      Logger.database('Records counted', { 
        table: this.tableName, 
        filters, 
        count: result.rows[0].count 
      });

      return parseInt(result.rows[0].count);
    } catch (error) {
      Logger.database('Error counting records', { 
        table: this.tableName, 
        filters, 
        error: error.message 
      });
      throw error;
    }
  }

  // =====================================================
  // 🔍 BUSCA AVANÇADA
  // =====================================================

  async search(searchFields, searchTerm, additionalFilters = {}, client = null) {
    try {
      const queryClient = client || this.pool;
      
      if (!searchFields || !searchTerm) {
        return [];
      }

      let query = `SELECT * FROM ${this.tableName} WHERE (`;
      const params = [];
      let paramCount = 0;

      // Constrói a busca por múltiplos campos
      const searchConditions = searchFields.map(field => {
        params.push(`%${searchTerm.toLowerCase()}%`);
        return `LOWER(${field}) LIKE $${++paramCount}`;
      });

      query += searchConditions.join(' OR ') + ')';

      // Adiciona filtros adicionais
      Object.keys(additionalFilters).forEach(key => {
        if (additionalFilters[key] !== undefined && additionalFilters[key] !== null) {
          params.push(additionalFilters[key]);
          query += ` AND ${key} = $${++paramCount}`;
        }
      });

      query += ` ORDER BY created_at DESC`;

      const result = await queryClient.query(query, params);
      
      Logger.database('Search completed', { 
        table: this.tableName, 
        searchTerm, 
        fields: searchFields,
        count: result.rows.length 
      });

      return result.rows;
    } catch (error) {
      Logger.database('Error searching records', { 
        table: this.tableName, 
        searchTerm, 
        error: error.message 
      });
      throw error;
    }
  }

  // =====================================================
  // 📈 VALIDAÇÕES ÚTEIS
  // =====================================================

  async exists(id, client = null) {
    try {
      const queryClient = client || this.pool;
      const query = `SELECT 1 FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
      const result = await queryClient.query(query, [id]);
      
      return result.rows.length > 0;
    } catch (error) {
      Logger.database('Error checking existence', { 
        table: this.tableName, 
        id, 
        error: error.message 
      });
      throw error;
    }
  }

  async isUnique(field, value, excludeId = null, client = null) {
    try {
      const queryClient = client || this.pool;
      
      let query = `SELECT 1 FROM ${this.tableName} WHERE ${field} = $1`;
      const params = [value];

      if (excludeId) {
        query += ` AND id != $2`;
        params.push(excludeId);
      }

      query += ` LIMIT 1`;

      const result = await queryClient.query(query, params);
      
      return result.rows.length === 0;
    } catch (error) {
      Logger.database('Error checking uniqueness', { 
        table: this.tableName, 
        field, 
        value, 
        error: error.message 
      });
      throw error;
    }
  }

  // =====================================================
  // 🔧 UTILITÁRIOS
  // =====================================================

  async executeRawQuery(query, params = [], client = null) {
    try {
      const queryClient = client || this.pool;
      
      Logger.database('Executing raw query', { 
        table: this.tableName, 
        query: query.substring(0, 100) + '...' 
      });

      const result = await queryClient.query(query, params);
      
      Logger.database('Raw query completed', { 
        table: this.tableName, 
        affectedRows: result.rows.length 
      });

      return result.rows;
    } catch (error) {
      Logger.database('Error executing raw query', { 
        table: this.tableName, 
        error: error.message 
      });
      throw error;
    }
  }

  async getTableInfo(client = null) {
    try {
      const queryClient = client || this.pool;
      
      const query = `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `;

      const result = await queryClient.query(query, [this.tableName]);
      
      return result.rows;
    } catch (error) {
      Logger.database('Error getting table info', { 
        table: this.tableName, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = { BaseRepository };