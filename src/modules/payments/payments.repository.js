// =====================================================
// REPOSITORY DE PAGAMENTOS
// =====================================================

const { BaseRepository } = require('../../shared/repository/BaseRepository');
const { AppError } = require('../../shared/errors/AppError');
const { Logger } = require('../../utils/Logger');
const { nanoid } = require('nanoid');

class PaymentsRepository extends BaseRepository {
  constructor(pool) {
    super(pool);
    this.tableName = 'payments';
  }

  // =====================================================
  // GERAR ID ÚNICO PARA PAGAMENTO
  // =====================================================

  generatePaymentId() {
    return `pay_${nanoid(16)}`;
  }

  // =====================================================
  // CRIAR PAGAMENTO
  // =====================================================

  async create(paymentData) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { appointmentId, amount, method, notes } = paymentData;

      // Verificar se o agendamento existe
      const appointmentCheck = await client.query(
        'SELECT id FROM appointments WHERE id = $1',
        [appointmentId]
      );

      if (appointmentCheck.rows.length === 0) {
        throw AppError.notFound('Agendamento não encontrado');
      }

      // Verificar se já existe pagamento para este agendamento
      const existingPayment = await client.query(
        'SELECT id FROM payments WHERE appointment_id = $1',
        [appointmentId]
      );

      if (existingPayment.rows.length > 0) {
        throw AppError.badRequest('Já existe um pagamento para este agendamento');
      }

      // Gerar ID único
      const paymentId = this.generatePaymentId();

      // Inserir pagamento
      const query = `
        INSERT INTO payments (
          id, appointment_id, amount, method, status, notes, created_at
        )
        VALUES ($1, $2, $3, $4, 'pending', $5, NOW())
        RETURNING *
      `;

      const result = await client.query(query, [
        paymentId,
        appointmentId,
        amount,
        method,
        notes || null
      ]);

      await client.query('COMMIT');

      Logger.info('Payment created successfully', { paymentId, appointmentId });

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error creating payment', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // BUSCAR POR ID
  // =====================================================

  async findById(paymentId) {
    try {
      const query = `
        SELECT 
          p.*,
          a.barber_id,
          a.user_id,
          a.service_id,
          a.appointment_date,
          a.appointment_time
        FROM payments p
        INNER JOIN appointments a ON p.appointment_id = a.id
        WHERE p.id = $1
      `;

      const result = await this.pool.query(query, [paymentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      Logger.error('Error finding payment by ID', error);
      throw error;
    }
  }

  // =====================================================
  // BUSCAR POR AGENDAMENTO
  // =====================================================

  async findByAppointmentId(appointmentId) {
    try {
      const query = `
        SELECT 
          p.*,
          a.barber_id,
          a.user_id,
          a.service_id
        FROM payments p
        INNER JOIN appointments a ON p.appointment_id = a.id
        WHERE p.appointment_id = $1
      `;

      const result = await this.pool.query(query, [appointmentId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      Logger.error('Error finding payment by appointment ID', error);
      throw error;
    }
  }

  // =====================================================
  // LISTAR COM FILTROS
  // =====================================================

  async findAll(filters = {}) {
    try {
      const {
        status,
        method,
        startDate,
        endDate,
        barberId,
        userId,
        page = 1,
        limit = 50
      } = filters;

      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      // Filtro por status
      if (status) {
        whereConditions.push(`p.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      // Filtro por método
      if (method) {
        whereConditions.push(`p.method = $${paramIndex}`);
        params.push(method);
        paramIndex++;
      }

      // Filtro por data inicial
      if (startDate) {
        whereConditions.push(`p.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      // Filtro por data final
      if (endDate) {
        whereConditions.push(`p.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      // Filtro por barbeiro
      if (barberId) {
        whereConditions.push(`a.barber_id = $${paramIndex}`);
        params.push(barberId);
        paramIndex++;
      }

      // Filtro por usuário (cliente)
      if (userId) {
        whereConditions.push(`a.user_id = $${paramIndex}`);
        params.push(userId);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM payments p
        INNER JOIN appointments a ON p.appointment_id = a.id
        ${whereClause}
      `;

      const countResult = await this.pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total);

      // Calcular paginação
      const offset = (page - 1) * limit;

      // Query para buscar dados
      const query = `
        SELECT 
          p.*,
          a.barber_id,
          a.user_id,
          a.service_id,
          a.appointment_date,
          a.appointment_time
        FROM payments p
        INNER JOIN appointments a ON p.appointment_id = a.id
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      return {
        data: result.rows.map(row => this.mapPaymentToResponse(row)),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      Logger.error('Error listing payments', error);
      throw error;
    }
  }

  // =====================================================
  // ATUALIZAR STATUS
  // =====================================================

  async updateStatus(paymentId, statusData) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { status, transactionId } = statusData;

      // Buscar pagamento atual
      const currentPayment = await client.query(
        'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
        [paymentId]
      );

      if (currentPayment.rows.length === 0) {
        throw AppError.notFound('Pagamento não encontrado');
      }

      const payment = currentPayment.rows[0];

      // Validar transições de status
      this.validateStatusTransition(payment.status, status);

      // Preparar campos para atualização
      let updateFields = ['status = $2', 'updated_at = NOW()'];
      let updateParams = [paymentId, status];
      let paramIndex = 3;

      // Se o status for 'paid', preencher paid_at
      if (status === 'paid') {
        updateFields.push(`paid_at = NOW()`);
      }

      // Atualizar transaction_id se fornecido
      if (transactionId) {
        updateFields.push(`transaction_id = $${paramIndex}`);
        updateParams.push(transactionId);
        paramIndex++;
      }

      const query = `
        UPDATE payments
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, updateParams);

      await client.query('COMMIT');

      Logger.info('Payment status updated', { paymentId, oldStatus: payment.status, newStatus: status });

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error updating payment status', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // CONFIRMAR PAGAMENTO
  // =====================================================

  async confirm(paymentId, confirmData) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const { method, transactionId } = confirmData;

      // Buscar pagamento atual
      const currentPayment = await client.query(
        'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
        [paymentId]
      );

      if (currentPayment.rows.length === 0) {
        throw AppError.notFound('Pagamento não encontrado');
      }

      const payment = currentPayment.rows[0];

      // Validar que o pagamento está pendente
      if (payment.status !== 'pending') {
        throw AppError.badRequest('Apenas pagamentos pendentes podem ser confirmados');
      }

      // Preparar atualização
      let updateFields = ['status = $2', 'paid_at = NOW()', 'updated_at = NOW()'];
      let updateParams = [paymentId, 'paid'];
      let paramIndex = 3;

      // Atualizar método se fornecido
      if (method) {
        updateFields.push(`method = $${paramIndex}`);
        updateParams.push(method);
        paramIndex++;
      }

      // Atualizar transaction_id se fornecido
      if (transactionId) {
        updateFields.push(`transaction_id = $${paramIndex}`);
        updateParams.push(transactionId);
        paramIndex++;
      }

      const query = `
        UPDATE payments
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, updateParams);

      await client.query('COMMIT');

      Logger.info('Payment confirmed', { paymentId });

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error confirming payment', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // PROCESSAR REEMBOLSO
  // =====================================================

  async refund(paymentId, reason) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Buscar pagamento atual
      const currentPayment = await client.query(
        'SELECT * FROM payments WHERE id = $1 FOR UPDATE',
        [paymentId]
      );

      if (currentPayment.rows.length === 0) {
        throw AppError.notFound('Pagamento não encontrado');
      }

      const payment = currentPayment.rows[0];

      // Validar que o pagamento está pago
      if (payment.status !== 'paid') {
        throw AppError.badRequest('Apenas pagamentos confirmados podem ser reembolsados');
      }

      // Atualizar para reembolsado
      const query = `
        UPDATE payments
        SET status = 'refunded',
            notes = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const refundNote = payment.notes
        ? `${payment.notes}\n\n[REEMBOLSO] ${reason}`
        : `[REEMBOLSO] ${reason}`;

      const result = await client.query(query, [paymentId, refundNote]);

      await client.query('COMMIT');

      Logger.info('Payment refunded', { paymentId, reason });

      return this.mapPaymentToResponse(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      Logger.error('Error refunding payment', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // =====================================================
  // RELATÓRIO: MÉTODOS DE PAGAMENTO
  // =====================================================

  async getPaymentMethodsReport(startDate, endDate) {
    try {
      const query = `
        SELECT 
          method,
          COUNT(*) as count,
          COALESCE(SUM(amount), 0) as total
        FROM payments
        WHERE status = 'paid'
          AND paid_at >= $1
          AND paid_at <= $2
        GROUP BY method
        ORDER BY total DESC
      `;

      const result = await this.pool.query(query, [startDate, endDate]);

      return result.rows.map(row => ({
        method: row.method,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }));
    } catch (error) {
      Logger.error('Error generating payment methods report', error);
      throw error;
    }
  }

  // =====================================================
  // VALIDAR TRANSIÇÃO DE STATUS
  // =====================================================

  validateStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      pending: ['paid', 'cancelled'],
      paid: ['refunded'],
      cancelled: [],
      refunded: []
    };

    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw AppError.badRequest(
        `Transição de status inválida: ${currentStatus} -> ${newStatus}`
      );
    }
  }

  // =====================================================
  // MAPEAR PARA RESPOSTA
  // =====================================================

  mapPaymentToResponse(row) {
    return {
      id: row.id,
      appointmentId: row.appointment_id.toString(),
      amount: parseFloat(row.amount),
      method: row.method,
      status: row.status,
      paidAt: row.paid_at ? row.paid_at.toISOString() : null,
      transactionId: row.transaction_id,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
      // Informações adicionais do agendamento (quando disponível)
      ...(row.barber_id && { barberId: row.barber_id }),
      ...(row.user_id && { userId: row.user_id }),
      ...(row.service_id && { serviceId: row.service_id })
    };
  }
}

module.exports = { PaymentsRepository };
