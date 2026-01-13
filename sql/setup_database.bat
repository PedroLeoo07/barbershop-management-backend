@echo off
REM =====================================================
REM SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS (Windows)
REM Sistema de Gestão de Barbearia
REM =====================================================

echo ======================================
echo 🏪 SETUP BANCO DE DADOS - BARBEARIA
echo ======================================

REM Variáveis de configuração
set DB_NAME=barbearia_db
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432

echo.
echo 📋 Configurações:
echo    Database: %DB_NAME%
echo    User: %DB_USER%
echo    Host: %DB_HOST%
echo    Port: %DB_PORT%
echo.

REM Verificar se PostgreSQL está instalado
echo 🔍 Verificando PostgreSQL...
psql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL não encontrado. Instale o PostgreSQL primeiro.
    pause
    exit /b 1
)

echo ✅ PostgreSQL encontrado
echo.

REM Verificar se o serviço está rodando
echo 🔍 Verificando se PostgreSQL está rodando...
pg_isready -h %DB_HOST% -p %DB_PORT% >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PostgreSQL não está rodando. Inicie o serviço PostgreSQL.
    echo    Tente: net start postgresql-x64-14
    pause
    exit /b 1
)

echo ✅ PostgreSQL está rodando
echo.

echo 🗄️ Executando scripts SQL...
echo.

REM 1. Criar banco de dados
echo 1. Criando banco de dados...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -c "DROP DATABASE IF EXISTS %DB_NAME%;" 2>nul
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -f "01_create_database.sql"
if %errorlevel% neq 0 (
    echo ❌ Erro ao criar banco de dados
    pause
    exit /b 1
)
echo ✅ Banco de dados criado
echo.

REM 2. Criar tabelas
echo 2. Criando tabelas...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "02_create_tables.sql"
if %errorlevel% neq 0 (
    echo ❌ Erro ao criar tabelas
    pause
    exit /b 1
)
echo ✅ Tabelas criadas
echo.

REM 3. Inserir dados iniciais
echo 3. Inserindo dados iniciais...
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "03_insert_data.sql"
if %errorlevel% neq 0 (
    echo ❌ Erro ao inserir dados iniciais
    pause
    exit /b 1
)
echo ✅ Dados iniciais inseridos
echo.

echo ======================================
echo 🎉 BANCO DE DADOS CONFIGURADO COM SUCESSO!
echo ======================================
echo.

echo 📊 Informações de acesso:
echo    🔗 Database: %DB_NAME%
echo    👤 Usuários padrão:
echo       Admin: admin@barbearia.com (senha: admin123)
echo       Barbeiro: joao@barbearia.com (senha: barber123)
echo       Cliente: cliente1@email.com (senha: client123)
echo.

echo ⚠️ IMPORTANTE:
echo    - Altere todas as senhas padrão em produção
echo    - Configure as variáveis de ambiente no arquivo .env
echo    - Execute 'npm install' e 'npm run dev' para iniciar o servidor
echo.

echo 📝 Próximos passos:
echo    1. cd ..  ^(Voltar para o diretório do projeto^)
echo    2. npm install
echo    3. copy .env.example .env  ^(Configure suas variáveis^)
echo    4. npm run dev
echo.

echo ✨ Pronto para uso!
pause