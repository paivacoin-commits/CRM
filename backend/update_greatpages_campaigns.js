// Script para atualizar campanha de todos os leads do GreatPages
// que não foram importados corretamente devido ao bug anterior
import { supabase } from './src/database/supabase.js';

async function updateGreatPagesLeadsCampaign() {
    console.log('🔄 Atualizando campanha dos leads do GreatPages...\n');

    try {
        // 1. Buscar configuração da campanha padrão do GreatPages
        const { data: settings, error: settingsError } = await supabase
            .from('api_settings')
            .select('greatpages_default_campaign_id')
            .single();

        if (settingsError) {
            console.error('❌ Erro ao buscar configuração:', settingsError);
            return;
        }

        const campaignId = settings?.greatpages_default_campaign_id;

        if (!campaignId) {
            console.log('⚠️ Nenhuma campanha padrão configurada para GreatPages');
            console.log('   Configure em: Configurações > GreatPages > Campanha Padrão');
            return;
        }

        console.log(`📋 Campanha padrão GreatPages: ${campaignId}\n`);

        // 2. Buscar todos os leads do GreatPages
        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, first_name, email, phone, campaign_id')
            .eq('source', 'greatpages');

        if (leadsError) {
            console.error('❌ Erro ao buscar leads:', leadsError);
            return;
        }

        console.log(`📊 Total de leads do GreatPages: ${leads.length}`);

        // 3. Filtrar leads que precisam ser atualizados
        const leadsToUpdate = leads.filter(lead => lead.campaign_id !== campaignId);

        console.log(`📝 Leads que precisam atualização: ${leadsToUpdate.length}\n`);

        if (leadsToUpdate.length === 0) {
            console.log('✅ Todos os leads já estão na campanha correta!');
            return;
        }

        // 4. Atualizar leads em lote
        let updated = 0;
        let errors = 0;

        for (const lead of leadsToUpdate) {
            const { error } = await supabase
                .from('leads')
                .update({ campaign_id: campaignId })
                .eq('id', lead.id);

            if (error) {
                console.error(`❌ Erro ao atualizar lead ${lead.id}:`, error.message);
                errors++;
            } else {
                updated++;
                console.log(`✅ ${updated}/${leadsToUpdate.length} - ${lead.first_name} (${lead.email || lead.phone})`);
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 RESUMO:');
        console.log(`   ✅ Atualizados: ${updated}`);
        console.log(`   ❌ Erros: ${errors}`);
        console.log(`   📋 Total processado: ${leadsToUpdate.length}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }

    process.exit(0);
}

updateGreatPagesLeadsCampaign();
