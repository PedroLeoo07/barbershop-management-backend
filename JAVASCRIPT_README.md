# Sistema de Gestão de Barbearia - Backend (JavaScript)

Este projeto foi convertido de TypeScript para JavaScript puro, utilizando queries SQL diretas para interação com o banco de dados PostgreSQL.

## 🚀 Como executar o projeto

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
# Servidor
PORT=3000
NODE_ENV=development

# Banco de dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barbearia_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_MAX_CONNECTIONS=20

# JWT
JWT_SECRET=your_jwt_secret_key_here_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_key_here_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Bcrypt
BCRYPT_ROUNDS=12
```

### 3. Executar migrations e seeds
```bash
npm run migration
npm run seed
```

### 4. Iniciar o servidor
```bash
# Modo desenvolvimento (com nodemon)
npm run dev

# Modo produção
npm start
```

## 📦 Scripts disponíveis

- `npm run dev` - Inicia o servidor em modo desenvolvimento com hot reload
- `npm start` - Inicia o servidor em modo produção
- `npm run migration` - Executa as migrations do banco de dados
- `npm run seed` - Executa os seeds (dados iniciais)
- `npm test` - Executa os testes

## 🏗️ Estrutura do Projeto

```
src/
├── config/
│   └── index.js          # Configurações da aplicação
├── controllers/          # Controladores HTTP
├── services/            # Lógica de negócio
├── repositories/        # Acesso a dados (SQL queries)
├── middlewares/         # Middlewares personalizados
│   ├── auth.js         # Autenticação JWT
│   ├── security.js     # Rate limiting e segurança
│   └── validation.js   # Validação de dados
├── models/             # Estruturas de dados
├── utils/              # Utilitários
│   ├── jwt.js         # JWT helper
│   ├── password.js    # Bcrypt helper
│   ├── responses.js   # Padronização de respostas
│   ├── datetime.js    # Utilitários de data/hora
│   └── validations.js # Validações com Zod
├── routes/             # Definição de rotas
│   ├── index.js       # Router principal
│   ├── authRoutes.js  # Rotas de autenticação
│   └── appointmentRoutes.js # Rotas de agendamentos
├── database/
│   ├── index.js       # Conexão com PostgreSQL
│   ├── migrations/    # SQL migrations
│   └── seeds/         # Dados iniciais
└── index.js           # Entrada da aplicação
```

## 🗄️ Banco de Dados

O projeto utiliza **SQL puro** com a biblioteca `pg` (node-postgres) para máximo controle e performance.

### Exemplos de Queries

```javascript
// Buscar usuário por email
async findByEmail(email) {
  const query = `
    SELECT 
      id, email, password_hash, role, 
      created_at, updated_at 
    FROM users 
    WHERE email = $1 AND deleted_at IS NULL
  `;
  const result = await database.query(query, [email]);
  return result.rows[0];
}

// Criar agendamento com transação
async create(appointmentData) {
  return await database.transaction(async (client) => {
    // Verificar disponibilidade
    const conflictQuery = `
      SELECT id FROM appointments 
      WHERE barber_id = $1 
      AND appointment_date = $2 
      AND status != 'cancelled'
    `;
    
    const conflicts = await client.query(conflictQuery, [
      appointmentData.barberId,
      appointmentData.appointmentDate
    ]);
    
    if (conflicts.rows.length > 0) {
      throw new Error('Horário não disponível');
    }
    
    // Criar agendamento
    const insertQuery = `
      INSERT INTO appointments (
        user_id, barber_id, service_id, 
        appointment_date, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      appointmentData.userId,
      appointmentData.barberId,
      appointmentData.serviceId,
      appointmentData.appointmentDate,
      appointmentData.notes
    ]);
    
    return result.rows[0];
  });
}
```

## 🔒 Recursos de Segurança

- **JWT + Refresh Token** para autenticação
- **Rate Limiting** configurável por endpoint
- **Bcrypt** para hash de senhas
- **Helmet** para headers de segurança
- **CORS** configurável
- **Validação rigorosa** com Zod
- **SQL Injection** prevenido com prepared statements
- **Sanitização** de entrada de dados

## 📝 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout

### Agendamentos
- `GET /api/appointments` - Listar agendamentos
- `POST /api/appointments` - Criar agendamento
- `GET /api/appointments/:id` - Buscar agendamento
- `PUT /api/appointments/:id` - Atualizar agendamento
- `DELETE /api/appointments/:id` - Cancelar agendamento

### Utilitários
- `GET /api/health` - Health check
- `GET /api/info` - Informações da API

## 🐳 Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## ⚡ Performance

- **Connection pooling** otimizado
- **Prepared statements** para todas as queries
- **Indices** estratégicos no banco
- **Rate limiting** para proteção
- **Compression** de respostas
- **Graceful shutdown**

---

✅ **Projeto convertido com sucesso para JavaScript!**
- Removidas todas as dependências do TypeScript
- Mantida a mesma arquitetura e funcionalidades
- Utiliza SQL queries diretas com a biblioteca `pg`
- Pronto para produção