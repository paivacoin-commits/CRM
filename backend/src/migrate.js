/**
 * Migration para adicionar novas colunas/tabelas
 * Executar uma vez: node src/migrate.js
 */

import db from './database/db.js';

console.log('🔄 Running migrations...');

// Adicionar coluna distribution_order se não existir
try {
    db.exec('ALTER TABLE users ADD COLUMN distribution_order INTEGER DEFAULT 999');
    console.log('✅ Added distribution_order column');
} catch (e) {
    if (e.message.includes('duplicate column')) console.log('⏭ distribution_order already exists');
    else console.log('ℹ', e.message);
}

// Criar tabela api_settings se não existir
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS api_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            webhook_token TEXT NOT NULL,
            webhook_enabled BOOLEAN DEFAULT 1,
            require_token BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Created api_settings table');
} catch (e) {
    console.log('ℹ', e.message);
}

console.log('🎉 Migrations complete!');
