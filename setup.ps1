# Script de Inicialização - Backend Barbearia
# Execute este script no PowerShell como Administrador

Write-Host "🏪 Iniciando configuração do Backend da Barbearia..." -ForegroundColor Green
Write-Host ""

# Verificar se está executando como administrador
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "❌ Este script deve ser executado como Administrador!" -ForegroundColor Red
    Write-Host "   Clique com botão direito no PowerShell e selecione 'Executar como Administrador'" -ForegroundColor Yellow
    Read-Host "Pressione Enter para sair"
    exit 1
}

# Função para verificar comando
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Verificar Node.js
Write-Host "🔍 Verificando Node.js..." -ForegroundColor Cyan
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✅ Node.js encontrado: $nodeVersion" -ForegroundColor Green
    
    # Verificar versão mínima (18+)
    $version = [version]($nodeVersion -replace 'v','')
    if ($version.Major -lt 18) {
        Write-Host "⚠️  Versão do Node.js muito antiga. Recomendado: v18+" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Node.js não encontrado!" -ForegroundColor Red
    Write-Host "   Instale em: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Pressione Enter para continuar"
}

# Verificar NPM
Write-Host "🔍 Verificando NPM..." -ForegroundColor Cyan
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "✅ NPM encontrado: v$npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ NPM não encontrado!" -ForegroundColor Red
    Read-Host "Pressione Enter para continuar"
}

# Verificar PostgreSQL
Write-Host "🔍 Verificando PostgreSQL..." -ForegroundColor Cyan
if (Test-Command "psql") {
    $pgVersion = psql --version
    Write-Host "✅ PostgreSQL encontrado: $pgVersion" -ForegroundColor Green
} else {
    Write-Host "⚠️  PostgreSQL não encontrado no PATH" -ForegroundColor Yellow
    Write-Host "   Se já instalado, adicione ao PATH ou instale em: https://www.postgresql.org/download/" -ForegroundColor Yellow
}

# Verificar Docker (opcional)
Write-Host "🔍 Verificando Docker (opcional)..." -ForegroundColor Cyan
if (Test-Command "docker") {
    $dockerVersion = docker --version
    Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
    $useDocker = Read-Host "Usar Docker? (y/N)"
} else {
    Write-Host "⚠️  Docker não encontrado (opcional)" -ForegroundColor Yellow
    $useDocker = "n"
}

Write-Host ""
Write-Host "📦 Instalando dependências..." -ForegroundColor Cyan

# Instalar dependências
try {
    npm install
    Write-Host "✅ Dependências instaladas com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Pressione Enter para continuar"
}

# Configurar arquivo .env
Write-Host ""
Write-Host "⚙️  Configurando arquivo .env..." -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "✅ Arquivo .env criado a partir do .env.example" -ForegroundColor Green
    } else {
        Write-Host "❌ Arquivo .env.example não encontrado!" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Arquivo .env já existe" -ForegroundColor Green
}

# Docker ou instalação local
if ($useDocker -eq "y" -or $useDocker -eq "Y") {
    Write-Host ""
    Write-Host "🐳 Configurando ambiente Docker..." -ForegroundColor Cyan
    
    # Verificar Docker Compose
    if (Test-Command "docker-compose" -or Test-Command "docker compose") {
        Write-Host "✅ Docker Compose encontrado" -ForegroundColor Green
        
        Write-Host "🚀 Iniciando containers..." -ForegroundColor Cyan
        try {
            if (Test-Command "docker-compose") {
                docker-compose up -d
            } else {
                docker compose up -d
            }
            Write-Host "✅ Containers iniciados com sucesso!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📊 Serviços disponíveis:" -ForegroundColor White
            Write-Host "   🔗 API: http://localhost:3000" -ForegroundColor Yellow
            Write-Host "   🗄️  Adminer: http://localhost:8080" -ForegroundColor Yellow
            Write-Host "   📊 Health: http://localhost:3000/api/health" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Erro ao iniciar containers!" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Docker Compose não encontrado!" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "💾 Configuração banco local..." -ForegroundColor Cyan
    
    # Verificar se PostgreSQL está rodando
    $pgService = Get-Service -Name "*postgresql*" -ErrorAction SilentlyContinue
    if ($pgService -and $pgService.Status -eq "Running") {
        Write-Host "✅ PostgreSQL está rodando" -ForegroundColor Green
        
        $createDb = Read-Host "Criar banco de dados 'barbearia_db'? (Y/n)"
        if ($createDb -ne "n" -and $createDb -ne "N") {
            Write-Host "🗄️  Criando banco de dados..." -ForegroundColor Cyan
            
            # Tentar criar o banco
            $dbUser = Read-Host "Usuário PostgreSQL (padrão: postgres)"
            if ([string]::IsNullOrEmpty($dbUser)) { $dbUser = "postgres" }
            
            try {
                & psql -U $dbUser -c "CREATE DATABASE barbearia_db;" postgres 2>$null
                Write-Host "✅ Banco criado com sucesso!" -ForegroundColor Green
                
                # Executar migrations
                Write-Host "📥 Executando migrations..." -ForegroundColor Cyan
                if (Test-Path "migrations") {
                    Get-ChildItem "migrations\*.sql" | Sort-Object Name | ForEach-Object {
                        Write-Host "   📄 Executando: $($_.Name)" -ForegroundColor Yellow
                        & psql -U $dbUser -d barbearia_db -f $_.FullName
                    }
                    Write-Host "✅ Migrations executadas!" -ForegroundColor Green
                } else {
                    Write-Host "⚠️  Pasta migrations não encontrada" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "❌ Erro ao criar banco!" -ForegroundColor Red
                Write-Host "   Verifique se o PostgreSQL está rodando e as credenciais estão corretas" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "⚠️  PostgreSQL não está rodando" -ForegroundColor Yellow
        Write-Host "   Inicie o serviço PostgreSQL antes de continuar" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔧 Compilando TypeScript..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "✅ TypeScript compilado com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao compilar TypeScript!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Comandos úteis:" -ForegroundColor White
Write-Host "   npm run dev          # Iniciar em modo desenvolvimento" -ForegroundColor Yellow
Write-Host "   npm start            # Iniciar em produção" -ForegroundColor Yellow
Write-Host "   npm run build        # Compilar TypeScript" -ForegroundColor Yellow
Write-Host "   npm test             # Executar testes" -ForegroundColor Yellow
Write-Host ""
Write-Host "📖 Documentação:" -ForegroundColor White
Write-Host "   README.md           # Documentação completa" -ForegroundColor Yellow
Write-Host "   API-EXAMPLES.md     # Exemplos de uso da API" -ForegroundColor Yellow
Write-Host ""

# Perguntar se quer iniciar o servidor
$startServer = Read-Host "Iniciar servidor agora? (Y/n)"
if ($startServer -ne "n" -and $startServer -ne "N") {
    Write-Host ""
    Write-Host "🚀 Iniciando servidor..." -ForegroundColor Green
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ Setup concluído! Execute 'npm run dev' para iniciar o servidor." -ForegroundColor Green
    Read-Host "Pressione Enter para sair"
}