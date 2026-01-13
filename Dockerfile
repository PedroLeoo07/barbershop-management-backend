# Backend da Barbearia - Node.js + JavaScript + PostgreSQL
FROM node:18-alpine AS base

# Instalar dependências do sistema
RUN apk add --no-cache postgresql-client

# Configurar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências
RUN npm ci --only=production && npm cache clean --force

# Copiar código fonte
COPY . .

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Configurar permissões
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expor porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "start"]
CMD ["npm", "start"]