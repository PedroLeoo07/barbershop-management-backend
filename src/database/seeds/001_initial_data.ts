import { database } from '../index';
import { PasswordService } from '../../utils/password';

export async function seedUsers(): Promise<void> {
  try {
    // Verificar se já existem usuários
    const existingUsers = await database.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      console.log('👥 Users already exist, skipping seed');
      return;
    }

    // Hash das senhas
    const adminPassword = await PasswordService.hashPassword('Admin@123');
    const barberPassword = await PasswordService.hashPassword('Barber@123');
    const clientPassword = await PasswordService.hashPassword('Client@123');

    const query = `
      INSERT INTO users (name, email, phone, password, role) VALUES
      ('Administrador Sistema', 'admin@barbearia.com', '(11) 99999-9999', $1, 'ADMIN'),
      ('João Silva', 'joao.silva@email.com', '(11) 98888-8888', $2, 'BARBER'),
      ('Pedro Santos', 'pedro.santos@email.com', '(11) 97777-7777', $2, 'BARBER'),
      ('Carlos Cliente', 'carlos@email.com', '(11) 96666-6666', $3, 'CLIENT'),
      ('Maria Cliente', 'maria@email.com', '(11) 95555-5555', $3, 'CLIENT');
    `;

    await database.query(query, [adminPassword, barberPassword, clientPassword]);
    console.log('✅ Users seeded successfully');

    // Buscar os barbeiros criados e criar registros na tabela barbers
    const barbersQuery = `
      SELECT id FROM users WHERE role = 'BARBER'
    `;
    const barbersResult = await database.query(barbersQuery);

    for (const barber of barbersResult.rows) {
      await database.query(`
        INSERT INTO barbers (user_id, specialties, commission_rate, is_available)
        VALUES ($1, 'Corte masculino, Barba, Bigode', 50.00, true)
      `, [barber.id]);
    }

    console.log('✅ Barbers seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }
}

export async function seedServices(): Promise<void> {
  try {
    // Verificar se já existem serviços
    const existingServices = await database.query('SELECT COUNT(*) as count FROM services');
    if (parseInt(existingServices.rows[0].count) > 0) {
      console.log('✂️ Services already exist, skipping seed');
      return;
    }

    const query = `
      INSERT INTO services (name, description, duration_minutes, price) VALUES
      ('Corte Masculino', 'Corte de cabelo masculino tradicional', 30, 25.00),
      ('Corte + Barba', 'Corte de cabelo + aparar barba', 45, 35.00),
      ('Barba Completa', 'Aparar e modelar barba completa', 20, 15.00),
      ('Corte Infantil', 'Corte de cabelo para crianças até 12 anos', 25, 20.00),
      ('Corte Social', 'Corte social para eventos', 40, 40.00),
      ('Bigode', 'Aparar e modelar bigode', 15, 10.00),
      ('Sobrancelha', 'Aparar sobrancelha masculina', 10, 8.00),
      ('Relaxamento', 'Tratamento capilar relaxante', 60, 50.00);
    `;

    await database.query(query);
    console.log('✅ Services seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding services:', error);
    throw error;
  }
}

export async function seedBusinessHours(): Promise<void> {
  try {
    // Verificar se já existem horários
    const existingHours = await database.query('SELECT COUNT(*) as count FROM business_hours');
    if (parseInt(existingHours.rows[0].count) > 0) {
      console.log('🕐 Business hours already exist, skipping seed');
      return;
    }

    const query = `
      INSERT INTO business_hours (day_of_week, start_time, end_time) VALUES
      (1, '08:00', '18:00'), -- Segunda
      (2, '08:00', '18:00'), -- Terça
      (3, '08:00', '18:00'), -- Quarta
      (4, '08:00', '18:00'), -- Quinta
      (5, '08:00', '18:00'), -- Sexta
      (6, '08:00', '16:00'); -- Sábado
      -- Domingo (0) não incluído - fechado
    `;

    await database.query(query);
    console.log('✅ Business hours seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding business hours:', error);
    throw error;
  }
}

export async function seedBarberSchedules(): Promise<void> {
  try {
    // Verificar se já existem horários de barbeiros
    const existingSchedules = await database.query('SELECT COUNT(*) as count FROM barber_schedules');
    if (parseInt(existingSchedules.rows[0].count) > 0) {
      console.log('📅 Barber schedules already exist, skipping seed');
      return;
    }

    // Buscar todos os barbeiros
    const barbersQuery = `
      SELECT b.id as barber_id FROM barbers b
      INNER JOIN users u ON b.user_id = u.id
      WHERE u.is_active = true AND b.is_available = true
    `;
    const barbersResult = await database.query(barbersQuery);

    for (const barber of barbersResult.rows) {
      // Criar horários padrão para cada barbeiro
      const scheduleQuery = `
        INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time) VALUES
        ($1, 1, '08:00', '17:00'), -- Segunda
        ($1, 2, '08:00', '17:00'), -- Terça
        ($1, 3, '08:00', '17:00'), -- Quarta
        ($1, 4, '08:00', '17:00'), -- Quinta
        ($1, 5, '08:00', '17:00'), -- Sexta
        ($1, 6, '08:00', '15:00'); -- Sábado
      `;

      await database.query(scheduleQuery, [barber.barber_id]);
    }

    console.log('✅ Barber schedules seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding barber schedules:', error);
    throw error;
  }
}

export async function seedSampleAppointments(): Promise<void> {
  try {
    // Verificar se já existem agendamentos
    const existingAppointments = await database.query('SELECT COUNT(*) as count FROM appointments');
    if (parseInt(existingAppointments.rows[0].count) > 0) {
      console.log('📅 Appointments already exist, skipping seed');
      return;
    }

    // Buscar clientes, barbeiros e serviços
    const clientsQuery = `SELECT id FROM users WHERE role = 'CLIENT' LIMIT 2`;
    const barbersQuery = `SELECT id FROM barbers LIMIT 2`;
    const servicesQuery = `SELECT id, price FROM services LIMIT 3`;

    const [clientsResult, barbersResult, servicesResult] = await Promise.all([
      database.query(clientsQuery),
      database.query(barbersQuery),
      database.query(servicesQuery)
    ]);

    if (clientsResult.rows.length === 0 || barbersResult.rows.length === 0 || servicesResult.rows.length === 0) {
      console.log('⚠️ Not enough data to create sample appointments');
      return;
    }

    // Criar alguns agendamentos de exemplo
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const appointments = [
      {
        client_id: clientsResult.rows[0].id,
        barber_id: barbersResult.rows[0].id,
        service_id: servicesResult.rows[0].id,
        appointment_date: formatDate(tomorrow),
        start_time: '09:00',
        end_time: '09:30',
        total_price: servicesResult.rows[0].price,
        status: 'SCHEDULED'
      },
      {
        client_id: clientsResult.rows[1].id,
        barber_id: barbersResult.rows[0].id,
        service_id: servicesResult.rows[1].id,
        appointment_date: formatDate(tomorrow),
        start_time: '10:00',
        end_time: '10:45',
        total_price: servicesResult.rows[1].price,
        status: 'CONFIRMED'
      },
      {
        client_id: clientsResult.rows[0].id,
        barber_id: barbersResult.rows[1] ? barbersResult.rows[1].id : barbersResult.rows[0].id,
        service_id: servicesResult.rows[2].id,
        appointment_date: formatDate(dayAfter),
        start_time: '14:00',
        end_time: '14:20',
        total_price: servicesResult.rows[2].price,
        status: 'SCHEDULED'
      }
    ];

    for (const appointment of appointments) {
      await database.query(`
        INSERT INTO appointments (
          client_id, barber_id, service_id, appointment_date,
          start_time, end_time, total_price, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        appointment.client_id,
        appointment.barber_id,
        appointment.service_id,
        appointment.appointment_date,
        appointment.start_time,
        appointment.end_time,
        appointment.total_price,
        appointment.status
      ]);
    }

    console.log('✅ Sample appointments seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding appointments:', error);
    throw error;
  }
}

// Função principal para executar todos os seeds
export async function runSeeds(): Promise<void> {
  try {
    console.log('🌱 Starting database seeding...');
    
    await seedUsers();
    await seedServices();
    await seedBusinessHours();
    await seedBarberSchedules();
    await seedSampleAppointments();
    
    console.log('✅ All seeds completed successfully!');
    console.log('\n📋 Default accounts created:');
    console.log('👨‍💼 Admin: admin@barbearia.com / Admin@123');
    console.log('✂️ Barber: joao.silva@email.com / Barber@123');
    console.log('✂️ Barber: pedro.santos@email.com / Barber@123');
    console.log('👤 Client: carlos@email.com / Client@123');
    console.log('👤 Client: maria@email.com / Client@123');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}