-- =====================================================
-- QUERIES ÚTEIS PARA CONSULTAS DO SISTEMA
-- =====================================================

-- Query para listar todos os barbeiros disponíveis com suas informações
SELECT 
    u.id,
    u.name AS barber_name,
    u.email,
    u.phone,
    b.bio,
    b.experience_years,
    b.specialties,
    b.hourly_rate,
    b.is_available
FROM users u
INNER JOIN barbers b ON u.id = b.user_id
WHERE u.role = 'barber' 
  AND u.is_active = true 
  AND u.deleted_at IS NULL
  AND b.is_available = true;

-- Query para listar agendamentos de um dia específico
SELECT 
    a.id,
    a.appointment_date,
    a.start_time,
    a.end_time,
    a.status,
    a.total_price,
    a.payment_status,
    u.name AS client_name,
    u.email AS client_email,
    u.phone AS client_phone,
    barber_user.name AS barber_name,
    s.name AS service_name,
    s.duration AS service_duration
FROM appointments a
INNER JOIN users u ON a.user_id = u.id
INNER JOIN barbers b ON a.barber_id = b.id
INNER JOIN users barber_user ON b.user_id = barber_user.id
INNER JOIN services s ON a.service_id = s.id
WHERE a.appointment_date = CURRENT_DATE
ORDER BY a.start_time;

-- Query para verificar horários disponíveis de um barbeiro em um dia
SELECT 
    time_slot,
    CASE 
        WHEN a.id IS NULL THEN 'Disponível'
        ELSE 'Ocupado'
    END AS status
FROM (
    SELECT 
        generate_series(
            (SELECT opening_time FROM business_hours WHERE day_of_week = EXTRACT(DOW FROM CURRENT_DATE)),
            (SELECT closing_time FROM business_hours WHERE day_of_week = EXTRACT(DOW FROM CURRENT_DATE)) - INTERVAL '30 minutes',
            INTERVAL '30 minutes'
        )::TIME AS time_slot
) AS slots
LEFT JOIN appointments a ON 
    a.barber_id = 1 -- ID do barbeiro
    AND a.appointment_date = CURRENT_DATE
    AND a.start_time = slots.time_slot
    AND a.status NOT IN ('cancelled', 'no_show')
ORDER BY time_slot;

-- Query para relatório de faturamento por período
SELECT 
    DATE(a.appointment_date) AS date,
    COUNT(a.id) AS total_appointments,
    SUM(a.total_price) AS daily_revenue,
    AVG(a.total_price) AS avg_ticket,
    COUNT(DISTINCT a.barber_id) AS active_barbers
FROM appointments a
WHERE a.status = 'completed'
  AND a.payment_status = 'paid'
  AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(a.appointment_date)
ORDER BY date DESC;

-- Query para listar clientes mais frequentes
SELECT 
    u.id,
    u.name,
    u.email,
    u.phone,
    COUNT(a.id) AS total_appointments,
    SUM(a.total_price) AS total_spent,
    MAX(a.appointment_date) AS last_appointment,
    AVG(a.total_price) AS avg_spent
FROM users u
INNER JOIN appointments a ON u.id = a.user_id
WHERE u.role = 'client'
  AND a.status = 'completed'
  AND a.appointment_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY u.id, u.name, u.email, u.phone
HAVING COUNT(a.id) >= 3
ORDER BY total_spent DESC;

-- Query para performance dos barbeiros
SELECT 
    bu.name AS barber_name,
    COUNT(a.id) AS total_appointments,
    SUM(a.total_price) AS total_revenue,
    AVG(a.total_price) AS avg_ticket,
    ROUND(SUM(a.total_price) * b.commission_rate / 100, 2) AS estimated_commission,
    COUNT(DISTINCT DATE(a.appointment_date)) AS days_worked
FROM barbers b
INNER JOIN users bu ON b.user_id = bu.id
LEFT JOIN appointments a ON b.id = a.barber_id 
    AND a.status = 'completed'
    AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE bu.role = 'barber'
  AND bu.is_active = true
GROUP BY b.id, bu.name, b.commission_rate
ORDER BY total_revenue DESC;

-- Query para serviços mais populares
SELECT 
    s.name AS service_name,
    s.category,
    s.price,
    COUNT(a.id) AS times_booked,
    SUM(a.total_price) AS revenue_generated,
    ROUND(AVG(a.total_price), 2) AS avg_price_charged
FROM services s
LEFT JOIN appointments a ON s.id = a.service_id
    AND a.status = 'completed'
    AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
WHERE s.is_active = true
GROUP BY s.id, s.name, s.category, s.price
ORDER BY times_booked DESC;

-- Query para identificar horários de pico
SELECT 
    EXTRACT(HOUR FROM start_time) AS hour,
    COUNT(*) AS appointment_count,
    ROUND(AVG(total_price), 2) AS avg_revenue
FROM appointments
WHERE status = 'completed'
  AND appointment_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM start_time)
ORDER BY appointment_count DESC;

-- Query para agendamentos cancelados (análise de cancelamento)
SELECT 
    DATE_TRUNC('week', appointment_date) AS week,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) AS cancelled,
    COUNT(CASE WHEN status = 'no_show' THEN 1 END) AS no_shows,
    COUNT(*) AS total,
    ROUND(
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) * 100.0 / COUNT(*), 2
    ) AS cancellation_rate
FROM appointments
WHERE appointment_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY DATE_TRUNC('week', appointment_date)
ORDER BY week DESC;

-- Query para verificar conflitos de agendamento
SELECT 
    a1.id AS appointment1_id,
    a2.id AS appointment2_id,
    a1.appointment_date,
    a1.start_time,
    a1.end_time,
    bu.name AS barber_name
FROM appointments a1
INNER JOIN appointments a2 ON 
    a1.barber_id = a2.barber_id
    AND a1.appointment_date = a2.appointment_date
    AND a1.id != a2.id
    AND (
        (a1.start_time < a2.end_time AND a1.end_time > a2.start_time)
    )
INNER JOIN barbers b ON a1.barber_id = b.id
INNER JOIN users bu ON b.user_id = bu.id
WHERE a1.status NOT IN ('cancelled', 'no_show')
  AND a2.status NOT IN ('cancelled', 'no_show');

-- Query para dashboard administrativo
SELECT 
    -- Agendamentos hoje
    (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE) AS appointments_today,
    
    -- Faturamento hoje
    (SELECT COALESCE(SUM(total_price), 0) FROM appointments 
     WHERE appointment_date = CURRENT_DATE AND status = 'completed') AS revenue_today,
    
    -- Agendamentos pendentes
    (SELECT COUNT(*) FROM appointments 
     WHERE appointment_date >= CURRENT_DATE AND status = 'scheduled') AS pending_appointments,
    
    -- Total de clientes ativos
    (SELECT COUNT(*) FROM users 
     WHERE role = 'client' AND is_active = true AND deleted_at IS NULL) AS active_clients,
    
    -- Total de barbeiros ativos
    (SELECT COUNT(*) FROM users u INNER JOIN barbers b ON u.id = b.user_id
     WHERE u.role = 'barber' AND u.is_active = true AND b.is_available = true) AS active_barbers,
     
    -- Faturamento do mês
    (SELECT COALESCE(SUM(total_price), 0) FROM appointments 
     WHERE DATE_TRUNC('month', appointment_date) = DATE_TRUNC('month', CURRENT_DATE)
     AND status = 'completed') AS revenue_this_month;