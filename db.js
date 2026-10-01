// db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Criação do Pool de Conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'db_inscricoes',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Teste de conexão inicial
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexão com o banco de dados MySQL realizada com sucesso!');
        connection.release();
    } catch (error) {
        console.error('❌ Erro ao conectar ao MySQL:', error.message);
    }
})();

module.exports = pool;