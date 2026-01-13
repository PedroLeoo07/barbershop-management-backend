-- =====================================================
-- SISTEMA DE GESTÃO DE BARBEARIA
-- Script de Criação do Banco de Dados PostgreSQL
-- =====================================================

-- Criar o banco de dados
CREATE DATABASE barbearia_db
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'Portuguese_Brazil.1252'
    LC_CTYPE = 'Portuguese_Brazil.1252'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1;

-- Conectar ao banco de dados
\c barbearia_db;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Comentário do banco
COMMENT ON DATABASE barbearia_db IS 'Sistema completo de gestão de agendamentos para barbearia';