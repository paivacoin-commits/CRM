// Script simplificado para remover DEFAULT de status_id
// Como não temos RPC exec_sql, vamos executar via raw query
import { supabase } from './src/database/supabase.js';

async function runMigration() {
    console.log('🔄 Removendo DEFAULT de status_id...');
    console.log('');

    try {
        // Tentar executar diretamente
        const { error } = await supabase.rpc('exec', {
            query: 'ALTER TABLE leads ALTER COLUMN status_id DROP DEFAULT'
        });

        if (error) {
            console.error('❌ Erro ao executar via RPC:', error.message);
            console.log('');
            console.log('⚠️ Execute manualmente no Supabase SQL Editor:');
            console.log('');
            console.log('ALTER TABLE leads ALTER COLUMN status_id DROP DEFAULT;');
            console.log('');
            console.log('COMMENT ON COLUMN leads.status_id IS \'Status do lead. NULL = sem status atribuído (ex: leads do GreatPages que não devem ter status inicial)\';');
            console.log('');
        } else {
            console.log('✅ Migration executada com sucesso!');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.log('');
        console.log('📋 INSTRUÇÕES MANUAIS:');
        console.log('');
        console.log('1. Acesse o Supabase Dashboard');
        console.log('2. Vá em SQL Editor');
        console.log('3. Execute o seguinte SQL:');
        console.log('');
        console.log('   ALTER TABLE leads ALTER COLUMN status_id DROP DEFAULT;');
        console.log('');
        console.log('4. Depois execute:');
        console.log('');
        console.log('   COMMENT ON COLUMN leads.status_id IS \'Status do lead. NULL = sem status atribuído\';');
        console.log('');
    }

    process.exit(0);
}

runMigration();
