# 🗄️ BANCO DE DADOS SQL

Esta pasta contém todos os scripts SQL necessários para configurar o banco de dados PostgreSQL do sistema de barbearia.

## 📋 Arquivos Incluídos

### Scripts SQL
1. **`01_create_database.sql`** - Criação do banco de dados
2. **`02_create_tables.sql`** - Criação de todas as tabelas
3. **`03_insert_data.sql`** - Dados iniciais (seeds)
4. **`04_useful_queries.sql`** - Queries úteis para consultas

### Scripts de Setup
- **`setup_database.bat`** - Script automático para Windows
- **`setup_database.sh`** - Script automático para Linux/Mac

## 🚀 Como Configurar o Banco

### Opção 1: Script Automático (Recomendado)

**Windows:**
```cmd
cd sql
setup_database.bat
```

**Linux/Mac:**
```bash
cd sql
chmod +x setup_database.sh
./setup_database.sh
```

### Opção 2: Manual

1. **Criar o banco:**
```bash
psql -U postgres -f 01_create_database.sql
```

2. **Criar tabelas:**
```bash
psql -U postgres -d barbearia_db -f 02_create_tables.sql
```

3. **Inserir dados:**
```bash
psql -U postgres -d barbearia_db -f 03_insert_data.sql
```

## 🏗️ Estrutura do Banco

### Tabelas Principais

- **`users`** - Usuários (clientes, barbeiros, admins)
- **`barbers`** - Dados específicos dos barbeiros
- **`services`** - Serviços oferecidos
- **`appointments`** - Agendamentos
- **`business_hours`** - Horários de funcionamento
- **`refresh_tokens`** - Tokens JWT
- **`activity_logs`** - Log de auditoria

### Relacionamentos

```
users (1) -----> (N) appointments
barbers (1) ---> (N) appointments  
services (1) --> (N) appointments
users (1) -----> (1) barbers
```

## 👥 Usuários Padrão

Após executar os scripts, estes usuários estarão disponíveis:

### Administrador
- **Email:** `admin@barbearia.com`
- **Senha:** `admin123`
- **Papel:** Admin completo

### Barbeiros
- **João:** `joao@barbearia.com` (senha: `barber123`)
- **Pedro:** `pedro@barbearia.com` (senha: `barber123`)
- **Carlos:** `carlos@barbearia.com` (senha: `barber123`)

### Clientes
- **Cliente 1:** `cliente1@email.com` (senha: `client123`)
- **Cliente 2:** `cliente2@email.com` (senha: `client123`)
- **Cliente 3:** `cliente3@email.com` (senha: `client123`)

## 🛠️ Serviços Pré-cadastrados

1. Corte Masculino - R$ 25,00
2. Corte + Barba - R$ 35,00
3. Barba Completa - R$ 15,00
4. Bigode - R$ 8,00
5. Sobrancelha - R$ 10,00
6. Corte Infantil - R$ 20,00
7. Corte Degradê - R$ 30,00
8. Barba + Bigode - R$ 20,00
9. Hidratação - R$ 15,00
10. Luzes/Mechas - R$ 80,00

## 📊 Horários de Funcionamento

- **Segunda a Sexta:** 08:00 às 18:00
- **Sábado:** 08:00 às 17:00  
- **Domingo:** Fechado

## 🔍 Queries Úteis

O arquivo `04_useful_queries.sql` contém exemplos de consultas para:

- Listar barbeiros disponíveis
- Consultar agendamentos por dia
- Verificar horários livres
- Relatórios de faturamento
- Performance dos barbeiros
- Serviços mais populares
- Dashboard administrativo

## ⚠️ IMPORTANTE

### Segurança
- **Altere todas as senhas padrão em produção**
- Use senhas fortes e únicas
- Configure corretamente as permissões do PostgreSQL

### Backup
- Faça backup regular do banco de dados
- Teste a restauração periodicamente

### Performance
- Os índices já estão otimizados
- Monitore o crescimento da tabela de logs
- Configure log rotation se necessário

## 🔧 Requisitos

- PostgreSQL 12+ instalado
- Usuário com permissões para criar bancos
- Acesso via linha de comando (psql)

## 📝 Variáveis de Ambiente

Configure no arquivo `.env` do projeto:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=barbearia_db
DB_USER=postgres
DB_PASSWORD=sua_senha_postgres
```

---

✅ **Banco de dados pronto para uso com todas as funcionalidades!**