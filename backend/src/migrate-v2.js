/**
 * Migration v2 - Campanhas e marcação de grupo
 * Executar: node src/migrate-v2.js
 */

import db from './database/db.js';

console.log('🔄 Running migration v2...');

// Adicionar coluna in_group nos leads
try {
    db.exec('ALTER TABLE leads ADD COLUMN in_group BOOLEAN DEFAULT 1');
    console.log('✅ Added in_group column to leads');
} catch (e) {
    if (e.message.includes('duplicate column')) console.log('⏭ in_group already exists');
    else console.log('ℹ', e.message);
}

// Adicionar coluna is_active nos leads (para esconder leads antigos)
try {
    db.exec('ALTER TABLE leads ADD COLUMN is_active BOOLEAN DEFAULT 1');
    console.log('✅ Added is_active column to leads');
} catch (e) {
    if (e.message.includes('duplicate column')) console.log('⏭ is_active already exists');
    else console.log('ℹ', e.message);
}

// Adicionar coluna campaign_id nos leads
try {
    db.exec('ALTER TABLE leads ADD COLUMN campaign_id INTEGER');
    console.log('✅ Added campaign_id column to leads');
} catch (e) {
    if (e.message.includes('duplicate column')) console.log('⏭ campaign_id already exists');
    else console.log('ℹ', e.message);
}

// Criar tabela de campanhas/lançamentos
try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Created campaigns table');
} catch (e) {
    console.log('ℹ', e.message);
}

// Criar índice para campaign_id
try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id)');
    console.log('✅ Created campaign index');
} catch (e) {
    console.log('ℹ', e.message);
}

console.log('🎉 Migration v2 complete!');
