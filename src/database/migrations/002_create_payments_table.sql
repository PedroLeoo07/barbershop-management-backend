-- =====================================================
-- MIGRATION: CREATE PAYMENTS TABLE
-- Descrição: Tabela para gerenciamento de pagamentos
-- Data: 2026-01-19
-- =====================================================

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(255) PRIMARY KEY,
  appointment_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  method ENUM('pix', 'credit_card', 'debit_card', 'cash') NOT NULL,
  status ENUM('pending', 'paid', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP NULL,
  transaction_id VARCHAR(255) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  
  -- Unique Constraints
  UNIQUE KEY unique_appointment_payment (appointment_id),
  
  -- Indexes para performance
  INDEX idx_status (status),
  INDEX idx_method (method),
  INDEX idx_created_at (created_at),
  INDEX idx_paid_at (paid_at),
  INDEX idx_appointment_id (appointment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- COMENTÁRIOS DAS COLUNAS
-- =====================================================

ALTER TABLE payments 
  MODIFY COLUMN id VARCHAR(255) COMMENT 'Identificador único do pagamento (formato: pay_xxxxx)',
  MODIFY COLUMN appointment_id INT COMMENT 'ID do agendamento associado',
  MODIFY COLUMN amount DECIMAL(10, 2) COMMENT 'Valor do pagamento em reais',
  MODIFY COLUMN method ENUM('pix', 'credit_card', 'debit_card', 'cash') COMMENT 'Método de pagamento utilizado',
  MODIFY COLUMN status ENUM('pending', 'paid', 'cancelled', 'refunded') COMMENT 'Status atual do pagamento',
  MODIFY COLUMN paid_at TIMESTAMP NULL COMMENT 'Data e hora do pagamento confirmado',
  MODIFY COLUMN transaction_id VARCHAR(255) NULL COMMENT 'ID da transação do gateway de pagamento',
  MODIFY COLUMN notes TEXT NULL COMMENT 'Observações sobre o pagamento (motivo de reembolso, etc)';
