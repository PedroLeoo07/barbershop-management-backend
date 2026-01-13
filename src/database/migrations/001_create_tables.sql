-- =====================================================
-- MIGRATION 001: CRIAÇÃO DAS TABELAS PRINCIPAIS
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- TABELA DE USUÁRIOS
-- =====================================================

CREATE TYPE user_role AS ENUM ('customer', 'barber', 'admin');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Índices para usuários
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =====================================================
-- TABELA DE BARBEIROS (EXTENDS USERS)
-- =====================================================

CREATE TABLE barbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialties TEXT[],
    hourly_rate DECIMAL(10,2),
    commission_rate DECIMAL(5,2) DEFAULT 0.00,
    working_days INTEGER[] DEFAULT ARRAY[2,3,4,5,6], -- Ter-Sab
    working_hours JSONB DEFAULT '{"start": "09:00", "end": "18:00"}',
    lunch_break JSONB DEFAULT '{"start": "12:00", "end": "13:00"}',
    is_available BOOLEAN NOT NULL DEFAULT true,
    profile_image_url VARCHAR(500),
    bio TEXT,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_appointments INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para barbeiros
CREATE INDEX idx_barbers_user_id ON barbers(user_id);
CREATE INDEX idx_barbers_is_available ON barbers(is_available);
CREATE INDEX idx_barbers_rating ON barbers(rating);

-- =====================================================
-- TABELA DE SERVIÇOS
-- =====================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- em minutos
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para serviços
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_name ON services USING gin(to_tsvector('portuguese', name));

-- =====================================================
-- TABELA DE AGENDAMENTOS
-- =====================================================

CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL, -- em minutos
    status appointment_status NOT NULL DEFAULT 'scheduled',
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    confirmation_code VARCHAR(10) UNIQUE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_appointment_future CHECK (appointment_date > created_at),
    CONSTRAINT chk_valid_duration CHECK (duration >= 15 AND duration <= 480),
    CONSTRAINT chk_positive_price CHECK (total_price >= 0)
);

-- Índices para agendamentos
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_confirmation_code ON appointments(confirmation_code);

-- Índice composto para verificação de conflitos
CREATE INDEX idx_appointments_barber_date_status ON appointments(barber_id, appointment_date, status) 
WHERE status NOT IN ('cancelled', 'no_show');

-- =====================================================
-- TABELA DE TOKENS DE REFRESH
-- =====================================================

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_token_not_expired CHECK (expires_at > created_at)
);

-- Índices para refresh tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- =====================================================
-- TABELA DE LOGS DE ATIVIDADE
-- =====================================================

CREATE TYPE activity_type AS ENUM ('login', 'logout', 'appointment_created', 'appointment_updated', 'appointment_cancelled', 'user_created', 'user_updated', 'password_changed');

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type activity_type NOT NULL,
    description TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- =====================================================
-- FUNCTIONS E TRIGGERS
-- =====================================================

-- Function para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON barbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function para gerar código de confirmação
CREATE OR REPLACE FUNCTION generate_confirmation_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.confirmation_code IS NULL THEN
        NEW.confirmation_code = upper(substring(md5(random()::text) from 1 for 8));
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para gerar código de confirmação
CREATE TRIGGER generate_appointment_confirmation_code 
BEFORE INSERT ON appointments 
FOR EACH ROW EXECUTE FUNCTION generate_confirmation_code();

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View para agendamentos com detalhes completos
CREATE VIEW appointments_detailed AS
SELECT 
    a.id,
    a.appointment_date,
    a.duration,
    a.status,
    a.total_price,
    a.notes,
    a.confirmation_code,
    a.rating,
    a.review,
    a.created_at,
    a.updated_at,
    
    -- Dados do cliente
    uc.id as customer_id,
    uc.name as customer_name,
    uc.email as customer_email,
    uc.phone as customer_phone,
    
    -- Dados do barbeiro
    b.id as barber_id,
    ub.name as barber_name,
    ub.email as barber_email,
    b.rating as barber_rating,
    
    -- Dados do serviço
    s.id as service_id,
    s.name as service_name,
    s.description as service_description,
    s.category as service_category
    
FROM appointments a
JOIN users uc ON a.customer_id = uc.id
JOIN barbers b ON a.barber_id = b.id
JOIN users ub ON b.user_id = ub.id
JOIN services s ON a.service_id = s.id;

-- View para estatísticas dos barbeiros
CREATE VIEW barber_statistics AS
SELECT 
    b.id as barber_id,
    ub.name as barber_name,
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
    AVG(CASE WHEN a.rating IS NOT NULL THEN a.rating END) as average_rating,
    SUM(CASE WHEN a.status = 'completed' THEN a.total_price ELSE 0 END) as total_revenue,
    AVG(CASE WHEN a.status = 'completed' THEN a.total_price END) as average_appointment_value
    
FROM barbers b
JOIN users ub ON b.user_id = ub.id
LEFT JOIN appointments a ON b.id = a.barber_id
GROUP BY b.id, ub.name;

-- =====================================================
-- DADOS INICIAIS DE EXEMPLO
-- =====================================================

-- Inserir usuário administrador
INSERT INTO users (email, name, password_hash, role, is_active, email_verified) 
VALUES ('admin@barbearia.com', 'Administrador', '$2b$10$example_hash_here', 'admin', true, true);

-- Inserir serviços básicos
INSERT INTO services (name, description, duration, price, category) VALUES
('Corte de Cabelo', 'Corte de cabelo masculino tradicional', 30, 25.00, 'Cabelo'),
('Barba', 'Aparar e modelar barba', 20, 15.00, 'Barba'),
('Bigode', 'Aparar bigode', 10, 10.00, 'Barba'),
('Corte + Barba', 'Serviço completo de corte e barba', 45, 35.00, 'Combo'),
('Sobrancelha', 'Designer de sobrancelha masculina', 15, 12.00, 'Estética'),
('Tratamento Capilar', 'Hidratação e tratamento dos fios', 60, 40.00, 'Tratamento');

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE users IS 'Tabela principal de usuários do sistema';
COMMENT ON TABLE barbers IS 'Dados específicos dos barbeiros';
COMMENT ON TABLE services IS 'Catálogo de serviços oferecidos';
COMMENT ON TABLE appointments IS 'Agendamentos de clientes';
COMMENT ON TABLE refresh_tokens IS 'Tokens de refresh para autenticação';
COMMENT ON TABLE activity_logs IS 'Log de atividades do sistema';

COMMENT ON COLUMN appointments.appointment_date IS 'Data e hora do agendamento';
COMMENT ON COLUMN appointments.duration IS 'Duração em minutos';
COMMENT ON COLUMN appointments.confirmation_code IS 'Código único para confirmação';
COMMENT ON COLUMN barbers.working_days IS 'Array de dias da semana (0=Dom, 1=Seg, ...)';
COMMENT ON COLUMN barbers.working_hours IS 'JSON com horário de trabalho';

-- =====================================================
-- CONCLUSÃO
-- =====================================================

-- Verificar se todas as tabelas foram criadas
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'barbers', 'services', 'appointments', 'refresh_tokens', 'activity_logs')
ORDER BY tablename;