# =====================================================
# 🚀 SISTEMA PROFISSIONAL DE AGENDAMENTOS - BARBEARIA
# =====================================================

Backend profissional para sistema completo de gestão de agendamentos para barbearia, desenvolvido com Node.js, JavaScript e PostgreSQL.

## ✨ Recursos Implementados

### 🔥 **DIFERENCIAIS PROFISSIONAIS**

#### 🔒 **SQL LOCKS - Prevenção de Conflitos**
- **FOR UPDATE NOWAIT** para prevenir double bookings
- Transações atômicas com rollback automático
- Locks otimizados por barbeiro e horário
- Sistema de retry em caso de conflito

#### ⏰ **Geração Automática de Slots**
- Algoritmo inteligente de horários disponíveis
- Considera horário de funcionamento e almoço
- Filtra conflitos automaticamente
- Slots personalizáveis por barbeiro

#### 📁 **Arquitetura Modular Profissional**
- Separação por módulos (`src/modules/`)
- Middlewares compartilhados (`src/shared/`)
- Repository pattern com base classes
- Service layer com regras de negócio

#### 🛡️ **Segurança Enterprise**
- Rate limiting por tipo de operação
- Middleware de autenticação JWT robusto
- Validação com Zod e traduções em português
- Tratamento de erros profissional

#### 📊 **Monitoramento e Logs**
- Health checks automáticos
- Métricas de performance
- Sistema de logs estruturado
- Response padronizadas

```
📦 Barbershop Backend
├── sql/                  # Scripts SQL do banco
│   ├── 01_create_database.sql
│   ├── 02_create_tables.sql
│   ├── 03_insert_data.sql
│   └── setup_database.bat
├── src/
│   ├── config/           # Configurações da aplicação
│   ├── controllers/      # Controladores HTTP
│   ├── services/         # Regras de negócio
│   ├── repositories/     # Acesso a dados (SQL puro)
│   ├── middlewares/      # Middlewares personalizados
│   ├── models/           # Estruturas de dados
│   ├── utils/            # Utilitários e helpers
│   ├── routes/           # Definição de rotas
│   └── database/         # Conexão com PostgreSQL
├── server.js             # Arquivo principal da aplicação
├── package.json          # Dependências
└── .env.example          # Configurações de ambiente
```

### 📋 Camadas da Aplicação

1. **Controllers:** Recebem requests HTTP, validam entrada e chamam services
2. **Services:** Contêm regras de negócio e orquestram chamadas aos repositories
3. **Repositories:** Executam queries SQL e interagem com o banco de dados
4. **Middlewares:** Autenticação, autorização, validação e segurança

## 🗄️ Modelagem do Banco de Dados

### Tabelas Principais

#### 👥 users
```sql
- id (UUID, PK)
- name (VARCHAR)
- email (VARCHAR, UNIQUE)
- phone (VARCHAR, UNIQUE)  
- password (VARCHAR, HASH)
- role (ENUM: CLIENT, BARBER, ADMIN)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### ✂️ barbers
```sql
- id (UUID, PK)
- user_id (UUID, FK → users.id)
- specialties (TEXT)
- commission_rate (DECIMAL)
- is_available (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 🛍️ services
```sql
- id (UUID, PK)
- name (VARCHAR, UNIQUE)
- description (TEXT)
- duration_minutes (INTEGER)
- price (DECIMAL)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 🕐 business_hours
```sql
- id (UUID, PK)
- day_of_week (INTEGER: 0-6)
- start_time (TIME)
- end_time (TIME)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 📅 barber_schedules
```sql
- id (UUID, PK)
- barber_id (UUID, FK → barbers.id)
- day_of_week (INTEGER: 0-6)
- start_time (TIME)
- end_time (TIME)
- is_active (BOOLEAN)
- created_at, updated_at (TIMESTAMP)
```

#### 📝 appointments
```sql
- id (UUID, PK)
- client_id (UUID, FK → users.id)
- barber_id (UUID, FK → barbers.id)
- service_id (UUID, FK → services.id)
- appointment_date (DATE)
- start_time (TIME)
- end_time (TIME)
- status (ENUM: SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
- total_price (DECIMAL)
- notes (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### 🔍 Índices de Performance

- **Busca de usuários:** `idx_users_email`, `idx_users_phone`
- **Agendamentos por barbeiro:** `idx_appointments_barber_date_time`
- **Agendamentos do dia:** `idx_appointments_today`
- **Relatórios de receita:** `idx_appointments_revenue`
- **Busca full-text:** `idx_users_name_email_search`

## ⚙️ Configuração e Instalação

### 1. Pré-requisitos

```bash
# Node.js 18+
node --version

# PostgreSQL 14+
psql --version

# npm ou yarn
npm --version
```

### 2. Instalação

```bash
# Clonar repositório
git clone <repository-url>
cd barbearia-backend

# Instalar dependências
npm install

# Copiar arquivo de ambiente
cp .env.example .env
```

### 3. Configuração do Banco

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de dados
CREATE DATABASE barbearia_db;

# Sair do psql
\q
```

### 4. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```env
# Environment
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barbearia_db
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
DB_MAX_CONNECTIONS=20

# JWT (IMPORTANTE: Gerar chaves seguras em produção)
JWT_SECRET=sua_chave_jwt_secreta_aqui_min_32_chars
JWT_REFRESH_SECRET=sua_chave_refresh_secreta_aqui_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Security
BCRYPT_ROUNDS=12
```

### 5. Executar Migrations e Seeds

```bash
# Executar migrations (criar tabelas)
npm run migration

# Executar seeds (dados iniciais)
npm run seed
```

### 6. Iniciar Aplicação

```bash
# Modo desenvolvimento
npm run dev

# Compilar TypeScript
npm run build

# Modo produção
npm start
```

## 🔐 Sistema de Autenticação

### JWT + Refresh Token

- **Access Token:** 15 minutos (configurável)
- **Refresh Token:** 7 dias (configurável)
- **Algoritmo:** HS256
- **Headers obrigatórios:** `Authorization: Bearer <token>`

### Roles e Permissões

#### 🔑 CLIENT
- Visualizar próprios agendamentos
- Criar novos agendamentos
- Cancelar próprios agendamentos
- Atualizar próprio perfil

#### ✂️ BARBER  
- Todas as permissões de CLIENT
- Visualizar agendamentos atribuídos
- Confirmar/iniciar/finalizar atendimentos
- Marcar clientes como "não compareceu"
- Gerenciar própria agenda

#### 👨‍💼 ADMIN
- Todas as permissões anteriores
- CRUD completo de usuários, barbeiros e serviços
- Visualizar todos os agendamentos
- Acessar dashboard e relatórios
- Gerenciar horários de funcionamento

## 🛡️ Segurança Implementada

### Rate Limiting
```typescript
// Geral: 100 requests/15min
// Login: 5 tentativas/15min  
// Criação: 10 recursos/min
// Admin: 100 requests/min
```

### Headers de Segurança
- **X-Frame-Options:** DENY
- **X-Content-Type-Options:** nosniff
- **X-XSS-Protection:** 1; mode=block
- **Referrer-Policy:** strict-origin-when-cross-origin

### Validação de Entrada
- Sanitização automática de objetos perigosos
- Validação rigorosa com Zod schemas
- Prevenção de SQL Injection (prepared statements)

## 📡 API Endpoints

### 🔐 Autenticação (`/api/auth`)

```http
POST   /register          # Registrar usuário
POST   /login             # Login
POST   /refresh-token     # Renovar token
POST   /logout            # Logout
POST   /forgot-password   # Senha temporária
POST   /validate-token    # Validar token
GET    /profile           # Perfil do usuário
PUT    /profile           # Atualizar perfil
PUT    /change-password   # Alterar senha
```

### 📝 Agendamentos (`/api/appointments`)

```http
GET    /                  # Listar agendamentos
POST   /                  # Criar agendamento
GET    /available-slots   # Slots disponíveis
GET    /today             # Agendamentos de hoje
GET    /statistics        # Estatísticas (admin)
GET    /:id               # Buscar por ID
PUT    /:id               # Atualizar agendamento
DELETE /:id               # Cancelar agendamento

# Ações do barbeiro
PATCH  /:id/confirm       # Confirmar agendamento
PATCH  /:id/start         # Iniciar atendimento
PATCH  /:id/complete      # Finalizar atendimento
PATCH  /:id/no-show       # Marcar como não compareceu
PATCH  /:id/reschedule    # Reagendar
```

### 🛍️ Serviços (`/api/services`) - *Implementar*

```http
GET    /                  # Listar serviços
POST   /                  # Criar serviço (admin)
GET    /:id               # Buscar por ID
PUT    /:id               # Atualizar (admin)
DELETE /:id               # Desativar (admin)
GET    /popular           # Mais populares
```

## 🧠 Sistema Inteligente de Agendamentos

### Geração Automática de Slots

```typescript
// Algoritmo considera:
1. Horário de funcionamento da barbearia
2. Agenda individual do barbeiro  
3. Duração do serviço selecionado
4. Agendamentos já existentes
5. Intervalo entre atendimentos (30min)
```

### Prevenção de Conflitos

```sql
-- Trigger que impede conflitos automáticamente
CREATE TRIGGER appointment_conflict_check
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION check_appointment_conflict();
```

### Queries de Performance

```sql
-- Slots disponíveis (otimizada)
SELECT b.id, u.name, time_slots
FROM barbers b
JOIN users u ON b.user_id = u.id
JOIN barber_schedules bs ON b.id = bs.barber_id
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a 
  WHERE a.barber_id = b.id 
  AND a.appointment_date = $date
  AND time_ranges_overlap(...)
);
```

## 📊 Dashboard e Relatórios

### Estatísticas Principais

```sql
-- Query de dashboard executada diariamente
SELECT 
  COUNT(*) as total_appointments,
  COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
  COUNT(*) FILTER (WHERE appointment_date = CURRENT_DATE) as today,
  SUM(total_price) FILTER (WHERE status = 'COMPLETED') as revenue
FROM appointments 
WHERE appointment_date >= $start_date;
```

### Relatórios Disponíveis

- 📈 **Receita por período** (diária/semanal/mensal)
- 👥 **Performance dos barbeiros** (agendamentos/receita)
- 🛍️ **Popularidade dos serviços**
- 📅 **Taxa de ocupação** por barbeiro/período
- 🚫 **Taxa de cancelamento** e no-show

## 🗃️ Exemplos de Queries SQL Reais

### Buscar Agendamentos com Relacionamentos
```sql
SELECT 
  a.id, a.appointment_date, a.start_time, a.status,
  c.name as client_name, c.phone as client_phone,
  bu.name as barber_name,
  s.name as service_name, s.duration_minutes
FROM appointments a
INNER JOIN users c ON a.client_id = c.id
INNER JOIN barbers b ON a.barber_id = b.id  
INNER JOIN users bu ON b.user_id = bu.id
INNER JOIN services s ON a.service_id = s.id
WHERE a.appointment_date BETWEEN $1 AND $2
ORDER BY a.appointment_date, a.start_time;
```

### Performance de Barbeiros
```sql
SELECT 
  bu.name as barber_name,
  COUNT(a.id) as total_appointments,
  COUNT(*) FILTER (WHERE a.status = 'COMPLETED') as completed_appointments,
  SUM(a.total_price) FILTER (WHERE a.status = 'COMPLETED') as total_revenue,
  ROUND(AVG(s.duration_minutes), 2) as avg_service_duration
FROM barbers b
JOIN users bu ON b.user_id = bu.id
LEFT JOIN appointments a ON b.id = a.barber_id
LEFT JOIN services s ON a.service_id = s.id
WHERE a.appointment_date >= date_trunc('month', CURRENT_DATE)
GROUP BY b.id, bu.name
ORDER BY total_revenue DESC;
```

### Slots Disponíveis (Complexa)
```sql
WITH available_times AS (
  SELECT 
    b.id as barber_id,
    u.name as barber_name,
    generate_series(
      (bs.start_time::time),
      (bs.end_time::time - ($service_duration || ' minutes')::interval),
      '30 minutes'::interval
    )::time as slot_time
  FROM barbers b
  JOIN users u ON b.user_id = u.id
  JOIN barber_schedules bs ON b.id = bs.barber_id
  WHERE bs.day_of_week = extract(dow from $date::date)
  AND b.is_available = true
)
SELECT barber_id, barber_name, slot_time
FROM available_times at
WHERE NOT EXISTS (
  SELECT 1 FROM appointments a
  WHERE a.barber_id = at.barber_id
  AND a.appointment_date = $date
  AND a.start_time <= at.slot_time
  AND a.end_time > at.slot_time
  AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
)
ORDER BY slot_time, barber_name;
```

## 🧪 Executando e Testando

### Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Servidor com hot-reload
npm run build           # Compilar TypeScript
npm start              # Servidor produção

# Banco de dados  
npm run migration      # Executar migrations
npm run seed           # Executar seeds

# Utilitários
npm run test           # Executar testes (quando implementados)
```

### Endpoints para Teste

```bash
# Health check
curl http://localhost:3000/api/health

# Informações da API
curl http://localhost:3000/api/info

# Login (usar dados do seed)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barbearia.com","password":"Admin@123"}'

# Listar agendamentos (com token)
curl http://localhost:3000/api/appointments \
  -H "Authorization: Bearer <seu_token_aqui>"
```

## 🏪 Contas Padrão (Seeds)

Após executar `npm run seed`, as seguintes contas ficam disponíveis:

```
👨‍💼 Admin:
Email: admin@barbearia.com
Senha: Admin@123

✂️ Barbeiro 1:
Email: joao.silva@email.com
Senha: Barber@123

✂️ Barbeiro 2:
Email: pedro.santos@email.com  
Senha: Barber@123

👤 Cliente 1:
Email: carlos@email.com
Senha: Client@123

👤 Cliente 2:
Email: maria@email.com
Senha: Client@123
```

## 🚀 Deploy em Produção

### Variáveis de Ambiente de Produção

```env
NODE_ENV=production
PORT=80
DB_HOST=seu_db_host_producao
DB_SSL=true
JWT_SECRET=chave_super_segura_64_chars_ou_mais
CORS_ORIGIN=https://seudominio.com
```

### Configurações Recomendadas

1. **Banco:** PostgreSQL com SSL
2. **Proxy:** Nginx ou CloudFlare
3. **Logs:** Winston + File rotation
4. **Monitoramento:** PM2 ou Docker
5. **Backup:** Backup automático do PostgreSQL

### Checklist de Segurança

- [ ] Alterar todas as chaves JWT
- [ ] Configurar CORS específico  
- [ ] Habilitar SSL/HTTPS
- [ ] Rate limiting ajustado
- [ ] Logs de auditoria
- [ ] Backup automático
- [ ] Monitoramento de uptime

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC. Veja o arquivo `LICENSE` para mais detalhes.

---

**Sistema desenvolvido com ❤️ para gestão profissional de barbearias**