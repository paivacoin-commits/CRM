/**
 * Migration v3 - Histórico de importações
 * Executar: node src/migrate-v3.js
 */

import db from './database/db.js';

console.log('🔄 Running migration v3...');

// Criar tabela de lotes de importação
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            name TEXT,
            source TEXT DEFAULT 'manual',
            total_imported INTEGER DEFAULT 0,
            total_skipped INTEGER DEFAULT 0,
            total_updated INTEGER DEFAULT 0,
            campaign_id INTEGER,
            seller_id INTEGER,
            in_group BOOLEAN DEFAULT 1,
            is_reverted BOOLEAN DEFAULT 0,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reverted_at DATETIME
        )
    `);
    console.log('✅ Created import_batches table');
} catch (e) {
    console.log('ℹ', e.message);
}

// Adicionar coluna import_batch_id nos leads
try {
    db.exec('ALTER TABLE leads ADD COLUMN import_batch_id INTEGER');
    console.log('✅ Added import_batch_id column to leads');
} catch (e) {
    if (e.message.includes('duplicate column')) console.log('⏭ import_batch_id already exists');
    else console.log('ℹ', e.message);
}

// Criar índice
try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_leads_import_batch ON leads(import_batch_id)');
    console.log('✅ Created import_batch index');
} catch (e) {
    console.log('ℹ', e.message);
}

console.log('🎉 Migration v3 complete!');
