// server.js
const express = require('express');
const cors = require('cors');
const { body, param, query, validationResult } = require('express-validator');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(cors());
app.use(express.json());

/**
 * Middleware para verificar os resultados das validações
 */
const validarRequisicao = (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
        return res.status(400).json({
            sucesso: false,
            erros: erros.array().map(err => ({
                campo: err.path,
                mensagem: err.msg
            }))
        });
    }
    next();
};

/**
 * 1. REGRAS DE VALIDAÇÃO PARA QUERY STRINGS (GET /api/inscricoes)
 * Valida parâmetros passados na URL: ?curso=...&status=...&limite=...&pagina=...
 */
const regrasValidacaoConsulta = [
    query('curso')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('O parâmetro curso deve ter no máximo 100 caracteres.'),

    query('status')
        .optional()
        .trim()
        .toUpperCase()
        .isIn(['PENDENTE', 'PAGO', 'CANCELADO']).withMessage('O status deve ser PENDENTE, PAGO ou CANCELADO.'),

    query('limite')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('O limite deve ser um número inteiro entre 1 e 100.')
        .toInt(), // Converte para número inteiro

    query('pagina')
        .optional()
        .isInt({ min: 1 }).withMessage('A página deve ser um número inteiro maior ou igual a 1.')
        .toInt() // Converte para número inteiro
];

/**
 * 2. REGRAS DE VALIDAÇÃO PARA O CORPO DA REQUISIÇÃO (POST e PUT)
 */
const regrasValidacaoInscricao = [
    body('nome')
        .trim()
        .notEmpty().withMessage('O nome é obrigatório.')
        .isLength({ min: 3, max: 150 }).withMessage('O nome deve ter entre 3 e 150 caracteres.'),

    body('cpf')
        .trim()
        .notEmpty().withMessage('O CPF é obrigatório.')
        .matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/).withMessage('O CPF informado é inválido. Use o formato 000.000.000-00 ou apenas números.'),

    body('email')
        .trim()
        .notEmpty().withMessage('O e-mail é obrigatório.')
        .isEmail().withMessage('Informe um endereço de e-mail válido.')
        .normalizeEmail(),

    body('curso')
        .trim()
        .notEmpty().withMessage('O curso é obrigatório.')
        .isLength({ max: 100 }).withMessage('O nome do curso deve ter no máximo 100 caracteres.'),

    body('data_nascimento')
        .optional({ nullable: true, checkFalsy: true })
        .isISO8601().withMessage('A data de nascimento deve estar no formato YYYY-MM-DD.')
];

/**
 * 3. REGRA DE VALIDAÇÃO DE PARÂMETRO DE ROTA (:id)
 */
const regraValidacaoId = [
    param('id')
        .isInt({ min: 1 }).withMessage('O ID fornecido na URL deve ser um número inteiro válido.')
];

/**
 * -----------------------------------------------------------------------------
 * ROTAS DA API
 * -----------------------------------------------------------------------------
 */

/**
 * READ ALL - GET /api/inscricoes
 * Aceita filtros via Query String: ?curso=...&status=...&limite=10&pagina=1
 */
app.get(
    '/api/inscricoes',
    regrasValidacaoConsulta, // Aplica validação de query
    validarRequisicao,
    async (req, res) => {
        try {
            const { curso, status, limite = 10, pagina = 1 } = req.query;
            const offset = (pagina - 1) * limite;

            let querySql = `
                SELECT 
                    id,
                    nome,
                    cpf,
                    email,
                    curso,
                    status,
                    DATE_FORMAT(data_nascimento, '%d/%m/%Y') AS data_nascimento,
                    DATE_FORMAT(data_inscricao, '%d/%m/%Y %H:%i') AS data_inscricao
                FROM inscricoes
                WHERE 1=1
            `;
            const params = [];

            // Filtro por curso
            if (curso) {
                querySql += ` AND curso LIKE ?`;
                params.push(`%${curso}%`);
            }

            // Filtro por status
            if (status) {
                querySql += ` AND status = ?`;
                params.push(status);
            }

            // Padrão de ordenação e paginação
            querySql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
            params.push(limite, offset);

            const [rows] = await db.query(querySql, params);

            return res.status(200).json({
                sucesso: true,
                pagina,
                limite,
                totalExibidos: rows.length,
                dados: rows
            });
        } catch (error) {
            console.error('Erro ao buscar inscrições:', error);
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao consultar o banco de dados.'
            });
        }
    }
);

/**
 * CREATE - POST /api/inscricoes
 */
app.post(
    '/api/inscricoes',
    regrasValidacaoInscricao,
    validarRequisicao,
    async (req, res) => {
        try {
            const { nome, cpf, email, curso, data_nascimento } = req.body;

            const querySql = `
                INSERT INTO inscricoes (nome, cpf, email, curso, data_nascimento)
                VALUES (?, ?, ?, ?, ?)
            `;

            const [result] = await db.execute(querySql, [
                nome,
                cpf,
                email,
                curso,
                data_nascimento || null
            ]);

            return res.status(201).json({
                sucesso: true,
                mensagem: 'Inscrição realizada com sucesso!',
                id: result.insertId
            });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'Já existe uma inscrição cadastrada com este CPF.'
                });
            }

            console.error('Erro ao cadastrar inscrição:', error);
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno no servidor ao processar a inscrição.'
            });
        }
    }
);

/**
 * READ ONE - GET /api/inscricoes/:id
 */
app.get(
    '/api/inscricoes/:id',
    regraValidacaoId,
    validarRequisicao,
    async (req, res) => {
        try {
            const { id } = req.params;

            const querySql = `
                SELECT 
                    id,
                    nome,
                    cpf,
                    email,
                    curso,
                    status,
                    DATE_FORMAT(data_nascimento, '%d/%m/%Y') AS data_nascimento,
                    DATE_FORMAT(data_inscricao, '%d/%m/%Y %H:%i') AS data_inscricao
                FROM inscricoes
                WHERE id = ?
            `;

            const [rows] = await db.query(querySql, [id]);

            if (rows.length === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Inscrição não encontrada.'
                });
            }

            return res.status(200).json({
                sucesso: true,
                dados: rows[0]
            });
        } catch (error) {
            console.error('Erro ao buscar inscrição por ID:', error);
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao buscar a inscrição.'
            });
        }
    }
);

/**
 * UPDATE - PUT /api/inscricoes/:id
 */
app.put(
    '/api/inscricoes/:id',
    regraValidacaoId,
    regrasValidacaoInscricao,
    validarRequisicao,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { nome, cpf, email, curso, data_nascimento } = req.body;

            const querySql = `
                UPDATE inscricoes
                SET nome = ?, cpf = ?, email = ?, curso = ?, data_nascimento = ?
                WHERE id = ?
            `;

            const [result] = await db.execute(querySql, [
                nome,
                cpf,
                email,
                curso,
                data_nascimento || null,
                id
            ]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Inscrição não encontrada para atualização.'
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem: 'Inscrição atualizada com sucesso!'
            });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: 'O CPF informado já está sendo utilizado por outra inscrição.'
                });
            }

            console.error('Erro ao atualizar inscrição:', error);
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao atualizar a inscrição.'
            });
        }
    }
);

/**
 * DELETE - DELETE /api/inscricoes/:id
 */
app.delete(
    '/api/inscricoes/:id',
    regraValidacaoId,
    validarRequisicao,
    async (req, res) => {
        try {
            const { id } = req.params;

            const querySql = `DELETE FROM inscricoes WHERE id = ?`;

            const [result] = await db.execute(querySql, [id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    sucesso: false,
                    mensagem: 'Inscrição não encontrada para remoção.'
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem: 'Inscrição cancelada com sucesso!'
            });
        } catch (error) {
            console.error('Erro ao deletar inscrição:', error);
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro interno ao remover a inscrição.'
            });
        }
    }
);

// Inicialização do Servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🎓 Endpoints de inscrição ativos em: http://localhost:${PORT}/api/inscricoes`);
});