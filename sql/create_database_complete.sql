-- =====================================================
-- CRIAÇÃO DAS TABELAS FUNDAMENTAIS DA BARBEARIA
-- =====================================================

-- Deletar tabelas se existirem (para desenvolvimento)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS business_hours CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS barbers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- 1. TABELA DE USUÁRIOS (CLIENTES + ADMINS)
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'ADMIN')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- =====================================================
-- 2. TABELA DE BARBEIROS
-- =====================================================
CREATE TABLE barbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Opcional: se barbeiro tiver login
    is_active BOOLEAN DEFAULT true,
    avatar_url VARCHAR(500),
    experience_years INTEGER DEFAULT 0,
    specialties TEXT[], -- Array de especialidades
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_barbers_active ON barbers(is_active);
CREATE INDEX idx_barbers_user_id ON barbers(user_id);

-- =====================================================
-- 3. TABELA DE SERVIÇOS
-- =====================================================
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    category VARCHAR(50) DEFAULT 'GENERAL',
    is_active BOOLEAN DEFAULT true,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_services_active ON services(is_active);
CREATE INDEX idx_services_category ON services(category);
CREATE INDEX idx_services_price ON services(price);

-- =====================================================
-- 4. TABELA DE HORÁRIOS DE FUNCIONAMENTO
-- =====================================================
CREATE TABLE business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Domingo, 6=Sábado
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT false, -- Para dias fechados
    barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE, -- NULL = horário geral
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que open_time < close_time
    CHECK (open_time < close_time OR is_closed = true),
    
    -- Garantir apenas um horário por dia por barbeiro
    UNIQUE(day_of_week, barber_id)
);

-- Índices para performance
CREATE INDEX idx_business_hours_day ON business_hours(day_of_week);
CREATE INDEX idx_business_hours_barber ON business_hours(barber_id);

-- =====================================================
-- 5. TABELA DE AGENDAMENTOS (ATUALIZADA)
-- =====================================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    notes TEXT,
    confirmation_code VARCHAR(10) UNIQUE NOT NULL DEFAULT UPPER(LEFT(gen_random_uuid()::text, 8)),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Garantir que agendamento é no futuro (aplicado na aplicação)
    -- Garantir que não há sobreposição de horários
    EXCLUDE USING gist (
        barber_id WITH =,
        daterange(appointment_date, appointment_date, '[]') WITH &&,
        timerange(appointment_time, (appointment_time + (duration_minutes || ' minutes')::interval)::time) WITH &&
    ) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'))
);

-- Índices para performance e consultas frequentes
CREATE INDEX idx_appointments_user_id ON appointments(user_id);
CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);
CREATE INDEX idx_appointments_service_id ON appointments(service_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_appointments_confirmation ON appointments(confirmation_code);
CREATE INDEX idx_appointments_datetime ON appointments(appointment_date, appointment_time);

-- Índice composto para consultas de disponibilidade
CREATE INDEX idx_appointments_barber_date_time ON appointments(barber_id, appointment_date, appointment_time)
WHERE status NOT IN ('CANCELLED', 'NO_SHOW');

-- =====================================================
-- 6. TRIGGERS PARA UPDATED_AT AUTOMÁTICO
-- =====================================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para todas as tabelas
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_barbers_updated_at BEFORE UPDATE ON barbers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_hours_updated_at BEFORE UPDATE ON business_hours 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. DADOS INICIAIS ESSENCIAIS
-- =====================================================

-- Usuário admin padrão (senha: admin123)
INSERT INTO users (id, name, email, password_hash, role) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Administrador', 'admin@barbearia.com', '$2b$12$LQv3c1yqBCFcXz7n3RK7WeQtN0G8nkQ8hq4E8Xo8wQ9vJ6K5F7A8M', 'ADMIN');

-- Horários padrão de funcionamento (Terça a Sábado, 9h às 18h)
INSERT INTO business_hours (day_of_week, open_time, close_time, is_closed) VALUES 
(0, '09:00', '18:00', true),  -- Domingo: FECHADO
(1, '09:00', '18:00', true),  -- Segunda: FECHADO  
(2, '09:00', '18:00', false), -- Terça: 9h às 18h
(3, '09:00', '18:00', false), -- Quarta: 9h às 18h
(4, '09:00', '18:00', false), -- Quinta: 9h às 18h
(5, '09:00', '18:00', false), -- Sexta: 9h às 18h
(6, '08:00', '17:00', false); -- Sábado: 8h às 17h

-- Serviços padrão
INSERT INTO services (name, description, duration_minutes, price, category) VALUES 
('Corte Simples', 'Corte básico de cabelo masculino', 30, 25.00, 'CORTE'),
('Corte + Barba', 'Corte de cabelo + barba completa', 45, 35.00, 'CORTE'),
('Barba Completa', 'Aparar e finalizar a barba', 20, 15.00, 'BARBA'),
('Corte Degradê', 'Corte moderno com degradê', 40, 30.00, 'CORTE'),
('Lavagem + Corte', 'Lavagem, corte e finalização', 50, 40.00, 'PREMIUM');

-- Barbeiro exemplo
INSERT INTO barbers (name, description, is_active, experience_years, specialties) VALUES 
('João Silva', 'Barbeiro especialista em cortes modernos e barba', true, 8, ARRAY['Degradê', 'Barba', 'Cortes Clássicos']);

-- =====================================================
-- 8. VIEWS ÚTEIS PARA CONSULTAS
-- =====================================================

-- View para agendamentos com informações completas
CREATE VIEW v_appointments_full AS
SELECT 
    a.id,
    a.appointment_date,
    a.appointment_time,
    a.duration_minutes,
    a.total_price,
    a.status,
    a.notes,
    a.confirmation_code,
    u.name as client_name,
    u.email as client_email,
    u.phone as client_phone,
    b.name as barber_name,
    s.name as service_name,
    s.category as service_category,
    a.created_at,
    a.updated_at
FROM appointments a
JOIN users u ON a.user_id = u.id
JOIN barbers b ON a.barber_id = b.id  
JOIN services s ON a.service_id = s.id;

-- View para estatísticas rápidas
CREATE VIEW v_dashboard_stats AS
SELECT 
    'appointments_today' as metric,
    COUNT(*)::INTEGER as value
FROM appointments 
WHERE appointment_date = CURRENT_DATE 
AND status NOT IN ('CANCELLED', 'NO_SHOW')

UNION ALL

SELECT 
    'appointments_week' as metric,
    COUNT(*)::INTEGER as value
FROM appointments 
WHERE appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
AND status NOT IN ('CANCELLED', 'NO_SHOW')

UNION ALL

SELECT 
    'revenue_month' as metric,
    COALESCE(SUM(total_price), 0)::INTEGER as value
FROM appointments 
WHERE EXTRACT(MONTH FROM appointment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
AND EXTRACT(YEAR FROM appointment_date) = EXTRACT(YEAR FROM CURRENT_DATE)
AND status = 'COMPLETED';

-- =====================================================
-- 9. FUNÇÕES ÚTEIS
-- =====================================================

-- Função para verificar disponibilidade de horário
CREATE OR REPLACE FUNCTION check_availability(
    p_barber_id UUID,
    p_appointment_date DATE,
    p_appointment_time TIME,
    p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    end_time TIME;
    conflict_count INTEGER;
BEGIN
    -- Calcular horário de fim
    end_time := (p_appointment_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME;
    
    -- Verificar conflitos
    SELECT COUNT(*) INTO conflict_count
    FROM appointments
    WHERE barber_id = p_barber_id
    AND appointment_date = p_appointment_date
    AND status NOT IN ('CANCELLED', 'NO_SHOW')
    AND (
        -- Novo agendamento inicia durante agendamento existente
        p_appointment_time >= appointment_time 
        AND p_appointment_time < (appointment_time + (duration_minutes || ' minutes')::INTERVAL)::TIME
        
        OR
        
        -- Novo agendamento termina durante agendamento existente  
        end_time > appointment_time
        AND end_time <= (appointment_time + (duration_minutes || ' minutes')::INTERVAL)::TIME
        
        OR
        
        -- Novo agendamento engloba agendamento existente
        p_appointment_time <= appointment_time
        AND end_time >= (appointment_time + (duration_minutes || ' minutes')::INTERVAL)::TIME
    );
    
    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON TABLE users IS 'Usuários do sistema (clientes e administradores)';
COMMENT ON TABLE barbers IS 'Barbeiros disponíveis para agendamentos';
COMMENT ON TABLE services IS 'Serviços oferecidos pela barbearia';
COMMENT ON TABLE business_hours IS 'Horários de funcionamento por dia da semana';
COMMENT ON TABLE appointments IS 'Agendamentos de clientes com barbeiros';

COMMENT ON COLUMN appointments.status IS 'SCHEDULED: Agendado | CONFIRMED: Confirmado | IN_PROGRESS: Em andamento | COMPLETED: Finalizado | CANCELLED: Cancelado | NO_SHOW: Cliente faltou';

-- Estatísticas das tabelas criadas
SELECT 
    schemaname,
    tablename,
    attname AS column_name,
    typename AS data_type
FROM pg_tables t
JOIN pg_attribute a ON a.attrelid = (
    SELECT oid FROM pg_class WHERE relname = t.tablename
)
JOIN pg_type ty ON ty.oid = a.atttypid
WHERE t.schemaname = 'public' 
AND t.tablename IN ('users', 'barbers', 'services', 'business_hours', 'appointments')
AND a.attnum > 0
ORDER BY t.tablename, a.attnum;