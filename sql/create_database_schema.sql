-- 🧱 BANCO DE DADOS – SISTEMA DE BARBEARIA (POSTGRESQL)

-- 🔹 EXTENSÕES (OPCIONAL MAS PROFISSIONAL)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 👤 USERS (CLIENTES E ADM)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'ADMIN')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ✂️ BARBEIROS
CREATE TABLE barbers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🧴 SERVIÇOS
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🕒 HORÁRIOS DE FUNCIONAMENTO
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (day_of_week)
);

-- 📅 AGENDAMENTOS (CORE DO SISTEMA)
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES barbers(id),
  service_id UUID NOT NULL REFERENCES services(id),
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (
    status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')
  ),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🚀 ÍNDICES (PERFORMANCE REAL)
CREATE INDEX idx_appointments_barber_date 
ON appointments (barber_id, appointment_date);

CREATE INDEX idx_appointments_user 
ON appointments (user_id);

CREATE INDEX idx_appointments_status 
ON appointments (status);

-- 🔐 REFRESH TOKENS (SEGURANÇA)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ⛔ BLOQUEIO DE HORÁRIOS (BARBEIRO / ADMIN)
CREATE TABLE blocked_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barber_id UUID NOT NULL REFERENCES barbers(id),
  blocked_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 📊 LOGS DE AÇÕES – NÍVEL EMPRESA
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 🧪 DADOS INICIAIS (SEED)

-- ADMIN
INSERT INTO users (name, email, password_hash, role)
VALUES ('Administrador', 'admin@barbearia.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewTuAiaDqTqBgHM6', 'ADMIN');

-- SERVIÇOS
INSERT INTO services (name, duration_minutes, price) VALUES
('Corte Masculino', 30, 40.00),
('Barba', 20, 30.00),
('Corte + Barba', 50, 65.00);

-- BARBEIROS DE EXEMPLO
INSERT INTO barbers (name) VALUES
('Carlos Silva'),
('João Santos'),
('Pedro Lima');

-- HORÁRIOS
INSERT INTO business_hours (day_of_week, open_time, close_time) VALUES
(1, '09:00', '18:00'),
(2, '09:00', '18:00'),
(3, '09:00', '18:00'),
(4, '09:00', '18:00'),
(5, '09:00', '18:00'),
(6, '09:00', '14:00');

-- CONSTRAINT PARA EVITAR AGENDAMENTOS SOBREPOSTOS
-- Evita que dois agendamentos do mesmo barbeiro se sobreponham
CREATE OR REPLACE FUNCTION check_appointment_conflict()
RETURNS TRIGGER AS $$
DECLARE
    conflict_count INTEGER;
    service_duration INTEGER;
    end_time TIME;
BEGIN
    -- Buscar duração do serviço
    SELECT duration_minutes INTO service_duration 
    FROM services WHERE id = NEW.service_id;
    
    -- Calcular horário de fim
    end_time := NEW.appointment_time + (service_duration || ' minutes')::INTERVAL;
    
    -- Verificar conflitos
    SELECT COUNT(*) INTO conflict_count
    FROM appointments a
    JOIN services s ON a.service_id = s.id
    WHERE a.barber_id = NEW.barber_id
      AND a.appointment_date = NEW.appointment_date
      AND a.status NOT IN ('CANCELED')
      AND a.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
      AND (
        -- Novo agendamento começa durante um existente
        (NEW.appointment_time >= a.appointment_time AND 
         NEW.appointment_time < a.appointment_time + (s.duration_minutes || ' minutes')::INTERVAL)
        OR
        -- Novo agendamento termina durante um existente
        (end_time > a.appointment_time AND 
         end_time <= a.appointment_time + (s.duration_minutes || ' minutes')::INTERVAL)
        OR
        -- Novo agendamento engloba um existente
        (NEW.appointment_time <= a.appointment_time AND 
         end_time >= a.appointment_time + (s.duration_minutes || ' minutes')::INTERVAL)
      );
    
    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Conflito de horário detectado. Barbeiro já possui agendamento neste período.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
DROP TRIGGER IF EXISTS appointment_conflict_check ON appointments;
CREATE TRIGGER appointment_conflict_check
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION check_appointment_conflict();