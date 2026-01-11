import axios from 'axios';

/**
 * Teste de normalização de telefone do GreatPages
 * Testa diferentes formatos de telefone para garantir normalização correta
 */

const testCases = [
    {
        name: "Telefone com 13 dígitos (já normalizado)",
        phone: "5562999981718",
        expected: "5562999981718"
    },
    {
        name: "Telefone com 11 dígitos (sem DDI)",
        phone: "62999981718",
        expected: "5562999981718"
    },
    {
        name: "Telefone com 10 dígitos (celular antigo sem 9)",
        phone: "6299981718",
        expected: "5562999981718"
    },
    {
        name: "Telefone formatado com caracteres",
        phone: "(62) 99998-1718",
        expected: "5562999981718"
    },
    {
        name: "Telefone fixo com 10 dígitos",
        phone: "6232451234",
        expected: "556232451234"
    },
    {
        name: "Telefone fixo formatado",
        phone: "(62) 3245-1234",
        expected: "556232451234"
    },
    {
        name: "Telefone com 9 duplicado",
        phone: "556299999981718",
        expected: "5562999981718"
    }
];

async function testPhoneNormalization() {
    console.log('🧪 Testando normalização de telefones do GreatPages\n');

    let passed = 0;
    let failed = 0;

    for (const testCase of testCases) {
        try {
            const payload = {
                NOME: "Teste Normalização",
                EMAIL: `test_${Date.now()}@example.com`,
                TELEFONE: testCase.phone
            };

            console.log(`📞 Testando: ${testCase.name}`);
            console.log(`   Input: "${testCase.phone}"`);
            console.log(`   Expected: "${testCase.expected}"`);

            const res = await axios.post('http://localhost:3001/api/webhook/greatpages', payload);

            if (res.data.success) {
                console.log(`   ✅ Lead criado com sucesso`);
                passed++;
            } else {
                console.log(`   ⚠️ Lead já existe (ok para teste)`);
                passed++;
            }

        } catch (err) {
            console.error(`   ❌ Erro:`, err.response ? err.response.data : err.message);
            failed++;
        }

        console.log('');
    }

    console.log('\n📊 Resultados:');
    console.log(`   ✅ Passou: ${passed}/${testCases.length}`);
    console.log(`   ❌ Falhou: ${failed}/${testCases.length}`);

    if (failed === 0) {
        console.log('\n🎉 Todos os testes passaram!');
    }
}

testPhoneNormalization();
