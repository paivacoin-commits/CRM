// Script para testar se a configuração do GreatPages está sendo salva
const { supabase } = require('./src/database/supabase.js');

async function testGreatPagesConfig() {
    console.log('🔍 Testando configuração do GreatPages...\n');

    try {
        // 1. Verificar estrutura da tabela
        console.log('1️⃣ Verificando estrutura da tabela api_settings...');
        const { data: columns, error: colError } = await supabase
            .rpc('exec_sql', {
                sql_query: `
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'api_settings'
                    ORDER BY ordinal_position;
                `
            });

        if (colError) {
            console.log('⚠️ Não foi possível verificar via RPC, tentando select direto...');
        } else {
            console.log('Colunas da tabela:', columns);
        }

        // 2. Buscar configurações atuais
        console.log('\n2️⃣ Buscando configurações atuais...');
        const { data: settings, error: getError } = await supabase
            .from('api_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (getError) {
            console.error('❌ Erro ao buscar settings:', getError);
            return;
        }

        console.log('✅ Configurações atuais:');
        console.log('   - greatpages_ngrok_url:', settings.greatpages_ngrok_url || '(não definido)');
        console.log('   - greatpages_default_campaign_id:', settings.greatpages_default_campaign_id || '(não definido)');

        // 3. Testar salvamento
        console.log('\n3️⃣ Testando salvamento de campanha ID 1...');
        const { data: updated, error: updateError } = await supabase
            .from('api_settings')
            .update({
                greatpages_default_campaign_id: 1,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)
            .select()
            .single();

        if (updateError) {
            console.error('❌ Erro ao salvar:', updateError);
            if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
                console.log('\n⚠️ A coluna greatpages_default_campaign_id NÃO EXISTE!');
                console.log('Execute a migration no Supabase SQL Editor:');
                console.log('ALTER TABLE api_settings ADD COLUMN IF NOT EXISTS greatpages_default_campaign_id INTEGER;');
            }
            return;
        }

        console.log('✅ Salvamento bem-sucedido!');
        console.log('   - greatpages_default_campaign_id:', updated.greatpages_default_campaign_id);

        // 4. Verificar se persistiu
        console.log('\n4️⃣ Verificando se persistiu...');
        const { data: verified, error: verifyError } = await supabase
            .from('api_settings')
            .select('greatpages_default_campaign_id')
            .eq('id', 1)
            .single();

        if (verifyError) {
            console.error('❌ Erro ao verificar:', verifyError);
            return;
        }

        console.log('✅ Valor persistido:', verified.greatpages_default_campaign_id);

        if (verified.greatpages_default_campaign_id === 1) {
            console.log('\n🎉 SUCESSO! A configuração está sendo salva corretamente!');
        } else {
            console.log('\n❌ ERRO! O valor não foi salvo corretamente.');
        }

    } catch (err) {
        console.error('❌ Erro:', err);
    }
}

testGreatPagesConfig().then(() => {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
