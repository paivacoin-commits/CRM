// Script para executar a migration do GreatPages default campaign
const { supabase } = require('./src/database/supabase.js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('🔄 Executando migration: add_greatpages_default_campaign...');

    const migrationPath = path.join(__dirname, 'src/database/migrations/add_greatpages_default_campaign.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // Tentar executar diretamente se RPC não funcionar
            console.log('⚠️ RPC não disponível, tentando ALTER TABLE diretamente...');

            const { error: alterError } = await supabase
                .from('api_settings')
                .select('greatpages_default_campaign_id')
                .limit(1);

            if (alterError && alterError.message.includes('column') && alterError.message.includes('does not exist')) {
                console.log('❌ Coluna não existe. Execute manualmente no Supabase SQL Editor:');
                console.log(sql);
                process.exit(1);
            } else {
                console.log('✅ Coluna já existe!');
            }
        } else {
            console.log('✅ Migration executada com sucesso!');
        }
    } catch (err) {
        console.error('❌ Erro ao executar migration:', err);
        console.log('\n📋 Execute manualmente no Supabase SQL Editor:');
        console.log(sql);
        process.exit(1);
    }
}

runMigration().then(() => {
    console.log('✅ Processo concluído!');
    process.exit(0);
});
