// =====================================================
// REPOSITORY DE SERVIÇOS
// =====================================================

const { BaseRepository } = require('./BaseRepository');
const { AppError } = require('../utils/AppError');
const { Logger } = require('../utils/Logger');

class ServiceRepository extends BaseRepository {
  constructor(db) {
    super(db);
    this.tableName = 'services';
  }

  // =====================================================
  // MÉTODOS ESPECÍFICOS DE SERVIÇOS
  // =====================================================

  /**
   * Busca serviços ativos
   */
  async findActiveServices(client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT * FROM services 
         WHERE is_active = true 
         ORDER BY name`,
        []
      );

      return result.rows;

    } catch (error) {
      Logger.error('Error finding active services', error);
      throw error;
    }
  }

  /**
   * Busca serviços por faixa de preço
   */
  async findByPriceRange(minPrice, maxPrice, client = null) {
    try {
      const queryClient = client || this.db;
      
      const result = await queryClient.query(
        `SELECT * FROM services 
         WHERE price BETWEEN $1 AND $2 
         AND is_active = true 
         ORDER BY price`,
        [minPrice, maxPrice]
      );

      return result.rows;

    } catch (error) {
      Logger.error('Error finding services by price range', { minPrice, maxPrice, error });
      throw error;
    }
  }
