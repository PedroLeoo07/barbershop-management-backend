import { database } from '../index';

export async function createUsersTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(10) NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('CLIENT', 'BARBER', 'ADMIN')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Índices para performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

    -- Trigger para atualizar updated_at
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  await database.query(query);
  console.log('✅ Users table created successfully');
}

export async function createBarbersTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS barbers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      specialties TEXT,
      commission_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
      is_available BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_user_barber UNIQUE(user_id)
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_barbers_user_id ON barbers(user_id);
    CREATE INDEX IF NOT EXISTS idx_barbers_available ON barbers(is_available);

    -- Trigger para updated_at
    DROP TRIGGER IF EXISTS update_barbers_updated_at ON barbers;
    CREATE TRIGGER update_barbers_updated_at
      BEFORE UPDATE ON barbers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  await database.query(query);
  console.log('✅ Barbers table created successfully');
}

export async function createServicesTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      price DECIMAL(10,2) NOT NULL CHECK (price > 0),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_service_name UNIQUE(name)
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_services_name ON services(name) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);
    CREATE INDEX IF NOT EXISTS idx_services_price ON services(price) WHERE is_active = true;

    -- Trigger para updated_at
    DROP TRIGGER IF EXISTS update_services_updated_at ON services;
    CREATE TRIGGER update_services_updated_at
      BEFORE UPDATE ON services
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  await database.query(query);
  console.log('✅ Services table created successfully');
}

export async function createBusinessHoursTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS business_hours (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_day_of_week UNIQUE(day_of_week),
      CONSTRAINT check_time_order CHECK (end_time > start_time)
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_business_hours_day ON business_hours(day_of_week) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_business_hours_active ON business_hours(is_active);

    -- Trigger para updated_at
    DROP TRIGGER IF EXISTS update_business_hours_updated_at ON business_hours;
    CREATE TRIGGER update_business_hours_updated_at
      BEFORE UPDATE ON business_hours
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  await database.query(query);
  console.log('✅ Business Hours table created successfully');
}

export async function createBarberSchedulesTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS barber_schedules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT unique_barber_day UNIQUE(barber_id, day_of_week),
      CONSTRAINT check_barber_time_order CHECK (end_time > start_time)
    );

    -- Índices
    CREATE INDEX IF NOT EXISTS idx_barber_schedules_barber_id ON barber_schedules(barber_id);
    CREATE INDEX IF NOT EXISTS idx_barber_schedules_day ON barber_schedules(day_of_week) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_barber_schedules_active ON barber_schedules(is_active);

    -- Trigger para updated_at
    DROP TRIGGER IF EXISTS update_barber_schedules_updated_at ON barber_schedules;
    CREATE TRIGGER update_barber_schedules_updated_at
      BEFORE UPDATE ON barber_schedules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `;

  await database.query(query);
  console.log('✅ Barber Schedules table created successfully');
}

export async function createAppointmentsTable(): Promise<void> {
  const query = `
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES users(id),
      barber_id UUID NOT NULL REFERENCES barbers(id),
      service_id UUID NOT NULL REFERENCES services(id),
      appointment_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN (
        'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
      )),
      total_price DECIMAL(10,2) NOT NULL CHECK (total_price > 0),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      CONSTRAINT check_appointment_time_order CHECK (end_time > start_time),
      CONSTRAINT check_future_appointment CHECK (
        appointment_date >= CURRENT_DATE OR 
        (appointment_date = CURRENT_DATE AND start_time >= CURRENT_TIME)
      )
    );

    -- Índices complexos para performance
    CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_barber_id ON appointments(barber_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_created_at ON appointments(created_at);
    
    -- Índice composto para verificação de conflitos
    CREATE INDEX IF NOT EXISTS idx_appointments_barber_date_time ON appointments(
      barber_id, appointment_date, start_time, end_time
    ) WHERE status NOT IN ('CANCELLED', 'NO_SHOW');
    
    -- Índice para agendamentos do dia
    CREATE INDEX IF NOT EXISTS idx_appointments_today ON appointments(appointment_date, start_time)
    WHERE appointment_date = CURRENT_DATE;
    
    -- Índice para relatórios de receita
    CREATE INDEX IF NOT EXISTS idx_appointments_revenue ON appointments(
      appointment_date, status, total_price
    ) WHERE status = 'COMPLETED';

    -- Trigger para updated_at
    DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
    CREATE TRIGGER update_appointments_updated_at
      BEFORE UPDATE ON appointments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
      
    -- Trigger para validar conflitos de horário
    CREATE OR REPLACE FUNCTION check_appointment_conflict()
    RETURNS TRIGGER AS $$
    BEGIN
      -- Verificar conflitos apenas para agendamentos ativos
      IF NEW.status NOT IN ('CANCELLED', 'NO_SHOW') THEN
        -- Verificar se existe conflito com outros agendamentos
        IF EXISTS (
          SELECT 1 FROM appointments
          WHERE barber_id = NEW.barber_id
          AND appointment_date = NEW.appointment_date
          AND id != COALESCE(NEW.id, gen_random_uuid())
          AND status NOT IN ('CANCELLED', 'NO_SHOW')
          AND (
            (NEW.start_time < end_time AND NEW.end_time > start_time)
          )
        ) THEN
          RAISE EXCEPTION 'Conflito de horário detectado para o barbeiro na data e horário especificados';
        END IF;
      END IF;
      
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS appointment_conflict_check ON appointments;
    CREATE TRIGGER appointment_conflict_check
      BEFORE INSERT OR UPDATE ON appointments
      FOR EACH ROW
      EXECUTE FUNCTION check_appointment_conflict();
  `;

  await database.query(query);
  console.log('✅ Appointments table created successfully');
}

export async function createIndexesForPerformance(): Promise<void> {
  const query = `
    -- Índices adicionais para melhor performance em consultas complexas
    
    -- Para busca de usuários por nome e email
    CREATE INDEX IF NOT EXISTS idx_users_name_email_search ON users 
    USING gin(to_tsvector('portuguese', name || ' ' || email)) WHERE is_active = true;
    
    -- Para estatísticas de agendamentos por período
    CREATE INDEX IF NOT EXISTS idx_appointments_stats_period ON appointments(
      appointment_date, status, total_price, created_at
    );
    
    -- Para busca de slots disponíveis
    CREATE INDEX IF NOT EXISTS idx_available_slots ON barber_schedules(
      day_of_week, start_time, end_time, barber_id
    ) WHERE is_active = true;
    
    -- Para ranking de barbeiros por performance
    CREATE INDEX IF NOT EXISTS idx_barber_performance ON appointments(
      barber_id, status, appointment_date, total_price
    ) WHERE status = 'COMPLETED';
    
    -- Para estatísticas de serviços mais populares
    CREATE INDEX IF NOT EXISTS idx_service_popularity ON appointments(
      service_id, status, appointment_date, total_price
    ) WHERE status = 'COMPLETED';
  `;

  await database.query(query);
  console.log('✅ Performance indexes created successfully');
}

// Função principal para executar todas as migrations
export async function runMigrations(): Promise<void> {
  try {
    console.log('🚀 Starting database migrations...');
    
    await createUsersTable();
    await createBarbersTable();
    await createServicesTable();
    await createBusinessHoursTable();
    await createBarberSchedulesTable();
    await createAppointmentsTable();
    await createIndexesForPerformance();
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}