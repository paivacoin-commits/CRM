/**
 * Script de teste para API de Exclusão
 * 
 * Como usar:
 * 1. Configure o TOKEN e PHONE abaixo
 * 2. Execute: node test-exclusion-api.js
 */

const API_URL = 'http://localhost:3001/api/webhook/exclusion';

// ⚠️ CONFIGURE AQUI:
const TOKEN = 'SEU_TOKEN_AQUI'; // Pegar em Settings > Exclusion API
const PHONE = '5538992632030'; // Telefone para testar a exclusão

async function testExclusionAPI() {
    console.log('🧪 Testando API de Exclusão...\n');
    console.log(`📍 URL: ${API_URL}`);
    console.log(`🔑 Token: ${TOKEN}`);
    console.log(`📞 Telefone: ${PHONE}\n`);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            },
            body: JSON.stringify({
                phone: PHONE
            })
        });

        const data = await response.json();

        console.log(`📊 Status: ${response.status} ${response.statusText}\n`);
        console.log('📦 Resposta:');
        console.log(JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n✅ Teste concluído com sucesso!');

            if (data.results) {
                console.log('\n📋 Resultados por grupo:');
                data.results.forEach((result, index) => {
                    const icon = result.success ? '✅' : '❌';
                    console.log(`  ${icon} ${result.groupName || result.groupId}`);
                    if (result.error) {
                        console.log(`     Erro: ${result.error}`);
                    }
                });
            }
        } else {
            console.log('\n❌ Erro no teste!');
            console.log(`   ${data.error || 'Erro desconhecido'}`);
        }

    } catch (error) {
        console.error('\n💥 Erro ao fazer requisição:');
        console.error(error.message);
    }
}

// Executar teste
testExclusionAPI();
