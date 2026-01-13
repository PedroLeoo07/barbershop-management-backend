import { database } from '../database';
import { 
  Appointment, 
  CreateAppointmentData, 
  UpdateAppointmentData, 
  AppointmentStatus,
  AvailableSlot
} from '../models';

export class AppointmentRepository {
  /**
   * Buscar agendamento por ID com relacionamentos
   */
  static async findById(id: string): Promise<Appointment | null> {
    const query = `
      SELECT 
        a.id,
        a.client_id,
        a.barber_id,
        a.service_id,
        a.appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.total_price,
        a.notes,
        a.created_at,
        a.updated_at,
        
        -- Client data
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        
        -- Barber data
        bu.name as barber_name,
        bu.email as barber_email,
        b.specialties as barber_specialties,
        
        -- Service data
        s.name as service_name,
        s.description as service_description,
        s.duration_minutes as service_duration
      FROM appointments a
      INNER JOIN users c ON a.client_id = c.id
      INNER JOIN barbers b ON a.barber_id = b.id
      INNER JOIN users bu ON b.user_id = bu.id
      INNER JOIN services s ON a.service_id = s.id
      WHERE a.id = $1
    `;
    
    const result = await database.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      id: row.id,
      client_id: row.client_id,
      barber_id: row.barber_id,
      service_id: row.service_id,
      appointment_date: row.appointment_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      total_price: parseFloat(row.total_price),
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client: {
        id: row.client_id,
        name: row.client_name,
        email: row.client_email,
        phone: row.client_phone,
        role: 'CLIENT',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      barber: {
        id: row.barber_id,
        user_id: row.client_id, // Será corrigido no serviço
        specialties: row.barber_specialties,
        commission_rate: 0,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date(),
        user: {
          id: row.client_id,
          name: row.barber_name,
          email: row.barber_email,
          phone: '',
          role: 'BARBER',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      service: {
        id: row.service_id,
        name: row.service_name,
        description: row.service_description,
        duration_minutes: row.service_duration,
        price: parseFloat(row.total_price),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    };
  }

  /**
   * Criar novo agendamento
   */
  static async create(appointmentData: CreateAppointmentData & { 
    end_time: string; 
    total_price: number; 
  }): Promise<Appointment> {
    const query = `
      INSERT INTO appointments (
        client_id, barber_id, service_id, appointment_date,
        start_time, end_time, total_price, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        client_id,
        barber_id,
        service_id,
        appointment_date,
        start_time,
        end_time,
        status,
        total_price,
        notes,
        created_at,
        updated_at
    `;
    
    const values = [
      appointmentData.client_id,
      appointmentData.barber_id,
      appointmentData.service_id,
      appointmentData.appointment_date,
      appointmentData.start_time,
      appointmentData.end_time,
      appointmentData.total_price,
      appointmentData.notes || null
    ];
    
    const result = await database.query(query, values);
    return result.rows[0];
  }

  /**
   * Atualizar agendamento
   */
  static async update(id: string, appointmentData: UpdateAppointmentData & {
    end_time?: string;
  }): Promise<Appointment | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (appointmentData.appointment_date !== undefined) {
      fields.push(`appointment_date = $${paramCount++}`);
      values.push(appointmentData.appointment_date);
    }

    if (appointmentData.start_time !== undefined) {
      fields.push(`start_time = $${paramCount++}`);
      values.push(appointmentData.start_time);
    }

    if (appointmentData.end_time !== undefined) {
      fields.push(`end_time = $${paramCount++}`);
      values.push(appointmentData.end_time);
    }

    if (appointmentData.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(appointmentData.status);
    }

    if (appointmentData.notes !== undefined) {
      fields.push(`notes = $${paramCount++}`);
      values.push(appointmentData.notes);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    const query = `
      UPDATE appointments 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id,
        client_id,
        barber_id,
        service_id,
        appointment_date,
        start_time,
        end_time,
        status,
        total_price,
        notes,
        created_at,
        updated_at
    `;

    const result = await database.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Verificar conflitos de horário
   */
  static async checkTimeConflict(params: {
    barber_id: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    exclude_id?: string;
  }): Promise<boolean> {
    const conditions = [
      'barber_id = $1',
      'appointment_date = $2',
      'status NOT IN ($3, $4)',
      '(start_time < $5 AND end_time > $6)'
    ];

    const values = [
      params.barber_id,
      params.appointment_date,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
      params.end_time,
      params.start_time
    ];

    let paramCount = 7;

    if (params.exclude_id) {
      conditions.push(`id != $${paramCount++}`);
      values.push(params.exclude_id);
    }

    const query = `
      SELECT 1 
      FROM appointments
      WHERE ${conditions.join(' AND ')}
      LIMIT 1
    `;

    const result = await database.query(query, values);
    return result.rows.length > 0;
  }

  /**
   * Listar agendamentos com filtros
   */
  static async findAll(params: {
    page: number;
    limit: number;
    barber_id?: string;
    client_id?: string;
    status?: AppointmentStatus;
    start_date?: string;
    end_date?: string;
  }): Promise<{ appointments: Appointment[]; total: number }> {
    const offset = (params.page - 1) * params.limit;
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (params.barber_id) {
      conditions.push(`a.barber_id = $${paramCount++}`);
      values.push(params.barber_id);
    }

    if (params.client_id) {
      conditions.push(`a.client_id = $${paramCount++}`);
      values.push(params.client_id);
    }

    if (params.status) {
      conditions.push(`a.status = $${paramCount++}`);
      values.push(params.status);
    }

    if (params.start_date) {
      conditions.push(`a.appointment_date >= $${paramCount++}`);
      values.push(params.start_date);
    }

    if (params.end_date) {
      conditions.push(`a.appointment_date <= $${paramCount++}`);
      values.push(params.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM appointments a
      ${whereClause}
    `;

    // Query para buscar agendamentos
    const appointmentsQuery = `
      SELECT 
        a.id,
        a.client_id,
        a.barber_id,
        a.service_id,
        a.appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.total_price,
        a.notes,
        a.created_at,
        a.updated_at,
        
        c.name as client_name,
        c.phone as client_phone,
        
        bu.name as barber_name,
        
        s.name as service_name,
        s.duration_minutes as service_duration
      FROM appointments a
      INNER JOIN users c ON a.client_id = c.id
      INNER JOIN barbers b ON a.barber_id = b.id
      INNER JOIN users bu ON b.user_id = bu.id
      INNER JOIN services s ON a.service_id = s.id
      ${whereClause}
      ORDER BY a.appointment_date DESC, a.start_time DESC
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    values.push(params.limit, offset);

    const [countResult, appointmentsResult] = await Promise.all([
      database.query(countQuery, values.slice(0, -2)),
      database.query(appointmentsQuery, values)
    ]);

    const appointments: Appointment[] = appointmentsResult.rows.map(row => ({
      id: row.id,
      client_id: row.client_id,
      barber_id: row.barber_id,
      service_id: row.service_id,
      appointment_date: row.appointment_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      total_price: parseFloat(row.total_price),
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client: {
        id: row.client_id,
        name: row.client_name,
        email: '',
        phone: row.client_phone,
        role: 'CLIENT',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      barber: {
        id: row.barber_id,
        user_id: '',
        specialties: '',
        commission_rate: 0,
        is_available: true,
        created_at: new Date(),
        updated_at: new Date(),
        user: {
          id: '',
          name: row.barber_name,
          email: '',
          phone: '',
          role: 'BARBER',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      },
      service: {
        id: row.service_id,
        name: row.service_name,
        description: '',
        duration_minutes: row.service_duration,
        price: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));

    return {
      appointments,
      total: parseInt(countResult.rows[0].total)
    };
  }

  /**
   * Buscar agendamentos de hoje
   */
  static async findTodayAppointments(): Promise<Appointment[]> {
    const query = `
      SELECT 
        a.id,
        a.client_id,
        a.barber_id,
        a.service_id,
        a.appointment_date,
        a.start_time,
        a.end_time,
        a.status,
        a.total_price,
        a.notes,
        a.created_at,
        a.updated_at,
        
        c.name as client_name,
        c.phone as client_phone,
        
        bu.name as barber_name,
        
        s.name as service_name
      FROM appointments a
      INNER JOIN users c ON a.client_id = c.id
      INNER JOIN barbers b ON a.barber_id = b.id
      INNER JOIN users bu ON b.user_id = bu.id
      INNER JOIN services s ON a.service_id = s.id
      WHERE a.appointment_date = CURRENT_DATE
      AND a.status NOT IN ($1, $2)
      ORDER BY a.start_time ASC
    `;

    const result = await database.query(query, [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW
    ]);

    return result.rows.map(row => ({
      id: row.id,
      client_id: row.client_id,
      barber_id: row.barber_id,
      service_id: row.service_id,
      appointment_date: row.appointment_date,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      total_price: parseFloat(row.total_price),
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client: {
        id: row.client_id,
        name: row.client_name,
        email: '',
        phone: row.client_phone,
        role: 'CLIENT',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      service: {
        id: row.service_id,
        name: row.service_name,
        description: '',
        duration_minutes: 0,
        price: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    }));
  }

  /**
   * Gerar slots disponíveis para agendamento
   */
  static async findAvailableSlots(params: {
    date: string;
    service_id: string;
    barber_id?: string;
  }): Promise<AvailableSlot[]> {
    let barbersQuery = `
      SELECT 
        b.id as barber_id,
        u.name as barber_name,
        bs.start_time as schedule_start,
        bs.end_time as schedule_end,
        bh.start_time as business_start,
        bh.end_time as business_end,
        s.duration_minutes
      FROM barbers b
      INNER JOIN users u ON b.user_id = u.id
      INNER JOIN barber_schedules bs ON b.id = bs.barber_id
      INNER JOIN business_hours bh ON EXTRACT(DOW FROM $1::date) = bh.day_of_week
      CROSS JOIN services s
      WHERE b.is_available = true
      AND u.is_active = true
      AND bs.day_of_week = EXTRACT(DOW FROM $1::date)
      AND bs.is_active = true
      AND bh.is_active = true
      AND s.id = $2
      AND s.is_active = true
    `;

    const values: any[] = [params.date, params.service_id];
    let paramCount = 3;

    if (params.barber_id) {
      barbersQuery += ` AND b.id = $${paramCount++}`;
      values.push(params.barber_id);
    }

    barbersQuery += ` ORDER BY u.name ASC`;

    const barbersResult = await database.query(barbersQuery, values);
    
    if (barbersResult.rows.length === 0) {
      return [];
    }

    const availableSlots: AvailableSlot[] = [];

    for (const barber of barbersResult.rows) {
      // Buscar agendamentos existentes do barbeiro na data
      const appointmentsQuery = `
        SELECT start_time, end_time
        FROM appointments
        WHERE barber_id = $1
        AND appointment_date = $2
        AND status NOT IN ($3, $4)
        ORDER BY start_time
      `;

      const appointmentsResult = await database.query(appointmentsQuery, [
        barber.barber_id,
        params.date,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW
      ]);

      // Gerar slots baseado na agenda do barbeiro e horário de funcionamento
      const workStart = this.laterTime(barber.schedule_start, barber.business_start);
      const workEnd = this.earlierTime(barber.schedule_end, barber.business_end);
      
      const slots = this.generateTimeSlots(
        workStart,
        workEnd,
        barber.duration_minutes,
        appointmentsResult.rows.map(a => ({ start: a.start_time, end: a.end_time }))
      );

      // Adicionar slots disponíveis
      slots.forEach(slot => {
        availableSlots.push({
          barber_id: barber.barber_id,
          date: params.date,
          start_time: slot.start,
          end_time: slot.end,
          barber_name: barber.barber_name
        });
      });
    }

    return availableSlots.sort((a, b) => {
      const timeCompare = a.start_time.localeCompare(b.start_time);
      if (timeCompare === 0) {
        return a.barber_name.localeCompare(b.barber_name);
      }
      return timeCompare;
    });
  }

  /**
   * Estatísticas de agendamentos para dashboard
   */
  static async getAppointmentStats(params: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    revenue: number;
    today_appointments: number;
  }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (params.startDate) {
      conditions.push(`appointment_date >= $${paramCount++}`);
      values.push(params.startDate);
    }

    if (params.endDate) {
      conditions.push(`appointment_date <= $${paramCount++}`);
      values.push(params.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        COUNT(*) as total_appointments,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_appointments,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_appointments,
        COALESCE(SUM(total_price) FILTER (WHERE status = 'COMPLETED'), 0) as revenue,
        COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE) as today_appointments
      FROM appointments
      ${whereClause}
    `;

    const result = await database.query(query, values);
    const stats = result.rows[0];

    return {
      total_appointments: parseInt(stats.total_appointments),
      completed_appointments: parseInt(stats.completed_appointments),
      cancelled_appointments: parseInt(stats.cancelled_appointments),
      revenue: parseFloat(stats.revenue),
      today_appointments: parseInt(stats.today_appointments)
    };
  }

  // Métodos auxiliares privados
  private static laterTime(time1: string, time2: string): string {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    if (h1 > h2 || (h1 === h2 && m1 > m2)) {
      return time1;
    }
    return time2;
  }

  private static earlierTime(time1: string, time2: string): string {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    if (h1 < h2 || (h1 === h2 && m1 < m2)) {
      return time1;
    }
    return time2;
  }

  private static generateTimeSlots(
    startTime: string,
    endTime: string,
    durationMinutes: number,
    bookedSlots: Array<{ start: string; end: string }>
  ): Array<{ start: string; end: string }> {
    const slots: Array<{ start: string; end: string }> = [];
    const interval = 30; // 30 minutos entre slots
    
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };
    
    const minutesToTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    for (let time = startMinutes; time + durationMinutes <= endMinutes; time += interval) {
      const slotStart = minutesToTime(time);
      const slotEnd = minutesToTime(time + durationMinutes);
      
      // Verificar se o slot não conflita com agendamentos existentes
      const hasConflict = bookedSlots.some(booking => {
        const bookingStart = timeToMinutes(booking.start);
        const bookingEnd = timeToMinutes(booking.end);
        const slotStartMinutes = time;
        const slotEndMinutes = time + durationMinutes;
        
        return slotStartMinutes < bookingEnd && slotEndMinutes > bookingStart;
      });
      
      if (!hasConflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }
    
    return slots;
  }
}