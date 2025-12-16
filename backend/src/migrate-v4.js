/**
 * Migração V4 - Atualizar Status
 * - Renomeia "Venda Recuperada" para "Vendido"
 * - Adiciona campo is_system para status que não podem ser deletados
 */

import db from './database/db.js';

console.log('🔄 Iniciando migração v4 - Status personalizáveis...');

try {
    // 1. Adicionar coluna is_system se não existir
    const tableInfo = db.prepare("PRAGMA table_info(lead_statuses)").all();
    const hasIsSystem = tableInfo.some(col => col.name === 'is_system');

    if (!hasIsSystem) {
        console.log('  → Adicionando coluna is_system...');
        db.exec('ALTER TABLE lead_statuses ADD COLUMN is_system BOOLEAN DEFAULT 0');
    }

    // 2. Renomear "Venda Recuperada" para "Vendido"
    const vendaRecuperada = db.prepare("SELECT id FROM lead_statuses WHERE name = 'Venda Recuperada'").get();
    if (vendaRecuperada) {
        console.log('  → Renomeando "Venda Recuperada" para "Vendido"...');
        db.prepare("UPDATE lead_statuses SET name = 'Vendido' WHERE id = ?").run(vendaRecuperada.id);
    }

    // 3. Marcar status do sistema (que não podem ser deletados mas podem ser editados)
    // O status de conversão (Vendido/id=4) é o único que não pode ter nome alterado
    console.log('  → Marcando status do sistema...');
    db.exec(`
        UPDATE lead_statuses SET is_system = 1 WHERE is_conversion = 1
    `);

    console.log('✅ Migração v4 concluída com sucesso!');

    // Mostrar status atuais
    const statuses = db.prepare('SELECT * FROM lead_statuses ORDER BY display_order').all();
    console.log('\n📋 Status atuais:');
    statuses.forEach(s => {
        console.log(`   ${s.id}. ${s.name} (${s.is_system ? 'sistema' : 'customizável'}${s.is_conversion ? ', conversão' : ''})`);
    });

} catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
}
