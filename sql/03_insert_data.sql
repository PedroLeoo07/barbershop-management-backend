-- =====================================================
-- DADOS INICIAIS (SEEDS) PARA O SISTEMA
-- =====================================================

-- Inserir dados de horário de funcionamento padrão
INSERT INTO business_hours (day_of_week, opening_time, closing_time, is_active) VALUES
(1, '08:00:00', '18:00:00', true), -- Segunda-feira
(2, '08:00:00', '18:00:00', true), -- Terça-feira
(3, '08:00:00', '18:00:00', true), -- Quarta-feira
(4, '08:00:00', '18:00:00', true), -- Quinta-feira
(5, '08:00:00', '18:00:00', true), -- Sexta-feira
(6, '08:00:00', '17:00:00', true), -- Sábado
(0, NULL, NULL, false);            -- Domingo (fechado)

-- Inserir serviços padrão
INSERT INTO services (name, description, duration, price, category, is_active) VALUES
('Corte Masculino', 'Corte de cabelo masculino tradicional', 30, 25.00, 'Corte', true),
('Corte + Barba', 'Corte de cabelo + barba completa', 45, 35.00, 'Combo', true),
('Barba Completa', 'Aparar e modelar barba completa', 20, 15.00, 'Barba', true),
('Bigode', 'Aparar e modelar bigode', 10, 8.00, 'Barba', true),
('Sobrancelha', 'Design de sobrancelha masculina', 15, 10.00, 'Estética', true),
('Corte Infantil', 'Corte especial para crianças até 12 anos', 25, 20.00, 'Corte', true),
('Corte Degradê', 'Corte degradê moderno', 35, 30.00, 'Corte', true),
('Barba + Bigode', 'Barba completa + bigode', 25, 20.00, 'Barba', true),
('Hidratação', 'Tratamento hidratante para cabelo', 20, 15.00, 'Tratamento', true),
('Luzes/Mechas', 'Aplicação de luzes ou mechas', 90, 80.00, 'Coloração', true);

-- Inserir usuário administrador padrão
-- Senha padrão: admin123 (hash bcrypt com 12 rounds)
INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES
('admin@barbearia.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LjSJhLl9XRc4L5Lw.', 'Administrador', '(11) 99999-9999', 'admin', true, true);

-- Inserir usuários barbeiros de exemplo
-- Senha padrão para todos: barber123
INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES
('joao@barbearia.com', '$2b$12$8Hc4bPhJjl8JfGJCG5Fjke8WlXzM8q5t7q8h3n7FjJY9yP2uE5c5C', 'João Silva', '(11) 98888-8888', 'barber', true, true),
('pedro@barbearia.com', '$2b$12$8Hc4bPhJjl8JfGJCG5Fjke8WlXzM8q5t7q8h3n7FjJY9yP2uE5c5C', 'Pedro Santos', '(11) 97777-7777', 'barber', true, true),
('carlos@barbearia.com', '$2b$12$8Hc4bPhJjl8JfGJCG5Fjke8WlXzM8q5t7q8h3n7FjJY9yP2uE5c5C', 'Carlos Oliveira', '(11) 96666-6666', 'barber', true, true);

-- Inserir usuários clientes de exemplo
-- Senha padrão para todos: client123
INSERT INTO users (email, password_hash, name, phone, role, is_active, email_verified) VALUES
('cliente1@email.com', '$2b$12$5Zj7DfJhGgK4lHdM9KjLaO8XcRtQ2gY6pH9nF3vE8rW1sA7mC4bN5', 'Maria Silva', '(11) 95555-5555', 'client', true, true),
('cliente2@email.com', '$2b$12$5Zj7DfJhGgK4lHdM9KjLaO8XcRtQ2gY6pH9nF3vE8rW1sA7mC4bN5', 'José Santos', '(11) 94444-4444', 'client', true, true),
('cliente3@email.com', '$2b$12$5Zj7DfJhGgK4lHdM9KjLaO8XcRtQ2gY6pH9nF3vE8rW1sA7mC4bN5', 'Ana Costa', '(11) 93333-3333', 'client', true, true);

-- Inserir dados dos barbeiros
INSERT INTO barbers (user_id, bio, experience_years, specialties, hourly_rate, commission_rate, is_available) VALUES
((SELECT id FROM users WHERE email = 'joao@barbearia.com'), 
 'Especialista em cortes clássicos e modernos. 5 anos de experiência.', 
 5, 
 ARRAY['Corte Masculino', 'Degradê', 'Barba'], 
 50.00, 
 30.00, 
 true),
((SELECT id FROM users WHERE email = 'pedro@barbearia.com'), 
 'Expert em barbas e bigodes. Formação em design capilar.', 
 3, 
 ARRAY['Barba', 'Bigode', 'Sobrancelha'], 
 45.00, 
 25.00, 
 true),
((SELECT id FROM users WHERE email = 'carlos@barbearia.com'), 
 'Barbeiro tradicional com foco em atendimento familiar.', 
 8, 
 ARRAY['Corte Infantil', 'Corte Masculino', 'Hidratação'], 
 55.00, 
 35.00, 
 true);

-- Inserir alguns agendamentos de exemplo para demonstração
INSERT INTO appointments (user_id, barber_id, service_id, appointment_date, start_time, end_time, status, total_price, payment_status) VALUES
-- Agendamentos para hoje
((SELECT id FROM users WHERE email = 'cliente1@email.com'), 
 (SELECT id FROM barbers WHERE user_id = (SELECT id FROM users WHERE email = 'joao@barbearia.com')),
 (SELECT id FROM services WHERE name = 'Corte Masculino'),
 CURRENT_DATE,
 '10:00:00',
 '10:30:00',
 'scheduled',
 25.00,
 'pending'),

((SELECT id FROM users WHERE email = 'cliente2@email.com'), 
 (SELECT id FROM barbers WHERE user_id = (SELECT id FROM users WHERE email = 'pedro@barbearia.com')),
 (SELECT id FROM services WHERE name = 'Corte + Barba'),
 CURRENT_DATE,
 '14:00:00',
 '14:45:00',
 'confirmed',
 35.00,
 'paid'),

-- Agendamentos para amanhã
((SELECT id FROM users WHERE email = 'cliente3@email.com'), 
 (SELECT id FROM barbers WHERE user_id = (SELECT id FROM users WHERE email = 'carlos@barbearia.com')),
 (SELECT id FROM services WHERE name = 'Corte Infantil'),
 CURRENT_DATE + INTERVAL '1 day',
 '09:00:00',
 '09:25:00',
 'scheduled',
 20.00,
 'pending'),

((SELECT id FROM users WHERE email = 'cliente1@email.com'), 
 (SELECT id FROM barbers WHERE user_id = (SELECT id FROM users WHERE email = 'joao@barbearia.com')),
 (SELECT id FROM services WHERE name = 'Barba Completa'),
 CURRENT_DATE + INTERVAL '1 day',
 '16:00:00',
 '16:20:00',
 'scheduled',
 15.00,
 'pending');

-- Inserir log de atividade de exemplo
INSERT INTO activity_logs (user_id, action, table_name, record_id, new_values) VALUES
((SELECT id FROM users WHERE email = 'admin@barbearia.com'), 
 'SEED_DATA_INSERTED', 
 'system', 
 NULL, 
 '{"description": "Dados iniciais inseridos no sistema"}');

-- Comentários sobre os dados inseridos
/*
DADOS INSERIDOS:

1. HORÁRIOS DE FUNCIONAMENTO:
   - Segunda a Sexta: 08:00 às 18:00
   - Sábado: 08:00 às 17:00
   - Domingo: Fechado

2. SERVIÇOS (10 itens):
   - Corte Masculino (R$ 25,00)
   - Corte + Barba (R$ 35,00)
   - Barba Completa (R$ 15,00)
   - E outros...

3. USUÁRIOS:
   - 1 Administrador: admin@barbearia.com (senha: admin123)
   - 3 Barbeiros: joao@, pedro@, carlos@ (senha: barber123)
   - 3 Clientes: cliente1@, cliente2@, cliente3@ (senha: client123)

4. BARBEIROS:
   - João Silva: Especialista em cortes clássicos (5 anos)
   - Pedro Santos: Expert em barbas (3 anos)
   - Carlos Oliveira: Barbeiro tradicional (8 anos)

5. AGENDAMENTOS:
   - 4 agendamentos de exemplo para hoje e amanhã
   - Status variados: scheduled, confirmed
   - Diferentes barbeiros e serviços

SENHAS PADRÃO:
- admin123 (administrador)
- barber123 (barbeiros)
- client123 (clientes)

IMPORTANTE: Altere todas as senhas padrão em produção!
*/