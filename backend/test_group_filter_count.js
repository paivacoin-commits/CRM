/**
 * Script para testar a contagem de leads "Fora do Grupo"
 * Este script ajuda a diagnosticar o problema de contagem
 */

import { db, supabase } from './src/database/supabase.js';

async function testGroupFilterCount() {
    console.log('Testing group filter count...');
    console.log('');

    // 1. Buscar campanha
    const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name')
        .or('name.ilike.%LP 60 JAN SUPER%,name.ilike.%SUPER INTERESSADO%,name.ilike.%LP 05 JAN%');

    if (!campaigns || campaigns.length === 0) {
        console.log('ERROR: No campaign found');
        return;
    }

    const campaign = campaigns[0];
    console.log('Campaign found:', campaign.name, '(ID:', campaign.id, ')');
    console.log('');

    // 2. Contar total de leads na campanha
    const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .or('is_active.eq.true,is_active.is.null');

    console.log('Total leads in campaign:', totalLeads);
    console.log('');

    // 3. Buscar TODOS os leads da campanha
    const { data: allLeads } = await supabase
        .from('leads')
        .select('id, first_name, phone, campaign_id')
        .eq('campaign_id', campaign.id)
        .or('is_active.eq.true,is_active.is.null');

    console.log('Leads returned by query:', allLeads?.length || 0);
    console.log('');

    // 4. Buscar registros na tabela lead_campaign_groups
    const leadIds = allLeads.map(l => l.id);
    const { data: campaignGroups } = await supabase
        .from('lead_campaign_groups')
        .select('lead_id, campaign_id, in_group')
        .in('lead_id', leadIds)
        .eq('campaign_id', campaign.id);

    console.log('Records in lead_campaign_groups:', campaignGroups?.length || 0);
    console.log('');

    // 5. Criar mapa de in_group
    const groupsMap = new Map();
    (campaignGroups || []).forEach(cg => {
        const key = `${cg.lead_id}_${cg.campaign_id}`;
        groupsMap.set(key, cg.in_group);
    });

    // 6. Contar leads
    let foraDoGrupo = 0;
    let noGrupo = 0;
    let semRegistro = 0;

    allLeads.forEach(lead => {
        const key = `${lead.id}_${lead.campaign_id}`;
        const inGroupValue = groupsMap.has(key) ? groupsMap.get(key) : false;

        if (inGroupValue === false) {
            foraDoGrupo++;
            if (!groupsMap.has(key)) {
                semRegistro++;
            }
        } else {
            noGrupo++;
        }
    });

    console.log('RESULTS:');
    console.log('- Leads IN GROUP (in_group = true):', noGrupo);
    console.log('- Leads OUT OF GROUP (in_group = false or no record):', foraDoGrupo);
    console.log('- Leads WITHOUT RECORD in lead_campaign_groups:', semRegistro);
    console.log('');

    console.log('Test completed!');
}

testGroupFilterCount().catch(console.error);
