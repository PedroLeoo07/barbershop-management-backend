#!/bin/bash
# =====================================================
# SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS
# Sistema de Gestão de Barbearia
# =====================================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo -e "🏪 SETUP BANCO DE DADOS - BARBEARIA"
echo -e "${BLUE}======================================${NC}"

# Variáveis de configuração
DB_NAME="barbearia_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

echo -e "${YELLOW}📋 Configurações:${NC}"
echo -e "   Database: ${DB_NAME}"
echo -e "   User: ${DB_USER}"
echo -e "   Host: ${DB_HOST}"
echo -e "   Port: ${DB_PORT}"
echo ""

# Verificar se PostgreSQL está rodando
echo -e "${BLUE}🔍 Verificando PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL não encontrado. Instale o PostgreSQL primeiro.${NC}"
    exit 1
fi

# Verificar conexão
if ! pg_isready -h $DB_HOST -p $DB_PORT -q; then
    echo -e "${RED}❌ PostgreSQL não está rodando. Inicie o serviço PostgreSQL.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL está rodando${NC}"

# Executar scripts SQL
echo -e "${BLUE}🗄️  Executando scripts SQL...${NC}"

# 1. Criar banco de dados
echo -e "${YELLOW}1. Criando banco de dados...${NC}"
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}⚠️  Banco '$DB_NAME' já existe. Removendo...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
fi

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -f "01_create_database.sql"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Banco de dados criado${NC}"
else
    echo -e "${RED}❌ Erro ao criar banco de dados${NC}"
    exit 1
fi

# 2. Criar tabelas
echo -e "${YELLOW}2. Criando tabelas...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "02_create_tables.sql"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tabelas criadas${NC}"
else
    echo -e "${RED}❌ Erro ao criar tabelas${NC}"
    exit 1
fi

# 3. Inserir dados iniciais
echo -e "${YELLOW}3. Inserindo dados iniciais...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "03_insert_data.sql"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dados iniciais inseridos${NC}"
else
    echo -e "${RED}❌ Erro ao inserir dados iniciais${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 ======================================"
echo -e "🎉 BANCO DE DADOS CONFIGURADO COM SUCESSO!"
echo -e "🎉 ======================================${NC}"

echo ""
echo -e "${BLUE}📊 Informações de acesso:${NC}"
echo -e "   🔗 Database: ${DB_NAME}"
echo -e "   👤 Usuários padrão:"
echo -e "      Admin: admin@barbearia.com (senha: admin123)"
echo -e "      Barbeiro: joao@barbearia.com (senha: barber123)"
echo -e "      Cliente: cliente1@email.com (senha: client123)"

echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo -e "   - Altere todas as senhas padrão em produção"
echo -e "   - Configure as variáveis de ambiente no arquivo .env"
echo -e "   - Execute 'npm install' e 'npm run dev' para iniciar o servidor"

echo ""
echo -e "${BLUE}📝 Próximos passos:${NC}"
echo -e "   1. cd ../  # Voltar para o diretório do projeto"
echo -e "   2. npm install"
echo -e "   3. cp .env.example .env  # Configure suas variáveis"
echo -e "   4. npm run dev"

echo ""
echo -e "${GREEN}✨ Pronto para uso!${NC}"