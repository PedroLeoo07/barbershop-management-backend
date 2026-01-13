#!/bin/bash

# Script de inicialização completa do projeto
# Execute com: ./setup.sh

echo "🏪 ======================================"
echo "🎯 SETUP COMPLETO - BARBEARIA BACKEND"
echo "🏪 ======================================"

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale o Node.js 18+ primeiro."
    exit 1
fi

# Verificar se PostgreSQL está instalado
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL não encontrado. Instale o PostgreSQL 14+ primeiro."
    exit 1
fi

echo "✅ Node.js versão: $(node --version)"
echo "✅ PostgreSQL versão: $(psql --version | head -1)"

# Instalar dependências
echo "\n📦 Instalando dependências..."
npm install

# Verificar se arquivo .env existe
if [ ! -f .env ]; then
    echo "\n⚙️ Criando arquivo .env..."
    cp .env.example .env
    echo "📝 IMPORTANTE: Configure suas variáveis de ambiente no arquivo .env"
    echo "   - Senha do PostgreSQL"
    echo "   - Chaves JWT (gere chaves seguras para produção)"
fi

# Aguardar configuração do usuário
echo "\n⚡ Pressione ENTER após configurar o arquivo .env..."
read

# Executar migrations
echo "\n🗄️ Executando migrations (criando tabelas)..."
npm run migration

if [ $? -eq 0 ]; then
    echo "✅ Migrations executadas com sucesso!"
else
    echo "❌ Erro ao executar migrations. Verifique suas configurações."
    exit 1
fi

# Executar seeds
echo "\n🌱 Executando seeds (dados iniciais)..."
npm run seed

if [ $? -eq 0 ]; then
    echo "✅ Seeds executados com sucesso!"
else
    echo "❌ Erro ao executar seeds."
    exit 1
fi

echo "\n🎉 ======================================"
echo "🎉 SETUP COMPLETO! PROJETO PRONTO!"
echo "🎉 ======================================"
echo "\n📋 Próximos passos:"
echo "   npm run dev    # Iniciar em modo desenvolvimento"
echo "   npm run build  # Compilar TypeScript"
echo "   npm start      # Iniciar em produção"
echo "\n🔑 Contas criadas automaticamente:"
echo "   👨‍💼 Admin: admin@barbearia.com / Admin@123"
echo "   ✂️ Barbeiro: joao.silva@email.com / Barber@123"
echo "   👤 Cliente: carlos@email.com / Client@123"
echo "\n🌐 URLs importantes:"
echo "   API: http://localhost:3000/api"
echo "   Health: http://localhost:3000/api/health"
echo "   Info: http://localhost:3000/api/info"
echo "\n📚 Documentação completa no README.md"