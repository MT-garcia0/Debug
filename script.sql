-- 1. Criação do Banco de Dados (se ainda não existir)
CREATE DATABASE IF NOT EXISTS vestibular_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vestibular_db;

-- 2. Remoção da tabela antiga caso precise recriar (opcional)
DROP TABLE IF EXISTS inscricoes;

-- 3. Criação da tabela de Inscrições do Vestibular
CREATE TABLE inscricoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL,
    curso VARCHAR(100) NOT NULL,
    data_nascimento DATE NULL,
    status ENUM('PENDENTE', 'PAGO', 'CANCELADO') DEFAULT 'PENDENTE',
    data_inscricao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Criação de índices para otimizar buscas frequentes
CREATE INDEX idx_curso ON inscricoes(curso);
CREATE INDEX idx_cpf ON inscricoes(cpf);

-- 5. Inserção de dados fictícios para teste
INSERT INTO inscricoes (nome, cpf, email, curso, data_nascimento, status) VALUES
('Ana Silva', '123.456.789-00', 'ana.silva@email.com', 'Engenharia de Software', '2003-05-14', 'PAGO'),
('Carlos Eduardo', '987.654.321-11', 'carlos.eduardo@email.com', 'Medicina', '2001-11-20', 'PENDENTE'),
('Mariana Costa', '456.789.123-22', 'mariana.costa@email.com', 'Direito', '2002-08-03', 'PAGO'),
('Lucas Oliveira', '321.654.987-33', 'lucas.oliveira@email.com', 'Ciência da Computação', '2004-01-10', 'CANCELADO');