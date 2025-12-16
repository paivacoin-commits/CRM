/**
 * Database Configuration - SQLite with better-sqlite3
 * Configuração do banco de dados usando SQLite para facilidade de setup
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Criar instância do banco de dados
const db = new Database(join(__dirname, '../../data/crm.db'));

// Habilitar foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Inicializa o banco de dados executando o schema SQL
 */
export function initializeDatabase() {
    try {
        const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
        db.exec(schema);
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
        throw error;
    }
}

export default db;
