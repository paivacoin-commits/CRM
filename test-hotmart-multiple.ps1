# Script de teste para múltiplos webhooks do Hotmart
# Testa a criação e recebimento de webhooks em diferentes URLs

$baseUrl = "http://localhost:3001/api"
$token = "SEU_TOKEN_AQUI"  # Substitua pelo seu token de admin

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $token"
}

Write-Host "`n=== TESTE DE MÚLTIPLOS WEBHOOKS HOTMART ===" -ForegroundColor Cyan

# 1. Criar webhook #1 para campanha 1
Write-Host "`n1. Criando webhook #1..." -ForegroundColor Yellow
$webhook1 = @{
    campaign_id    = 1
    webhook_secret = ""
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$baseUrl/hotmart/configs" -Method POST -Headers $headers -Body $webhook1
    Write-Host "✅ Webhook #1 criado com sucesso!" -ForegroundColor Green
    Write-Host "   URL: http://localhost:3001/api/hotmart/webhook1" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Erro ao criar webhook #1: $_" -ForegroundColor Red
}

# 2. Criar webhook #2 para campanha 2
Write-Host "`n2. Criando webhook #2..." -ForegroundColor Yellow
$webhook2 = @{
    campaign_id    = 2
    webhook_secret = ""
} | ConvertTo-Json

try {
    $response2 = Invoke-RestMethod -Uri "$baseUrl/hotmart/configs" -Method POST -Headers $headers -Body $webhook2
    Write-Host "✅ Webhook #2 criado com sucesso!" -ForegroundColor Green
    Write-Host "   URL: http://localhost:3001/api/hotmart/webhook2" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Erro ao criar webhook #2: $_" -ForegroundColor Red
}

# 3. Listar todos os webhooks
Write-Host "`n3. Listando webhooks configurados..." -ForegroundColor Yellow
try {
    $configs = Invoke-RestMethod -Uri "$baseUrl/hotmart/configs" -Method GET -Headers $headers
    Write-Host "✅ Webhooks encontrados:" -ForegroundColor Green
    foreach ($config in $configs.configs) {
        Write-Host "   - Webhook #$($config.webhook_number): Campanha $($config.campaign_id), Ativo: $($config.is_enabled)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Erro ao listar webhooks: $_" -ForegroundColor Red
}

# 4. Enviar payload de teste para webhook #1
Write-Host "`n4. Enviando payload de teste para webhook #1..." -ForegroundColor Yellow
$testPayload1 = @{
    event = "PURCHASE_COMPLETE"
    data  = @{
        buyer   = @{
            name  = "Teste Webhook 1"
            email = "teste.webhook1.$(Get-Date -Format 'yyyyMMddHHmmss')@hotmart.com"
            phone = "11999999991"
        }
        product = @{
            name = "Produto Teste Webhook 1"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $result1 = Invoke-RestMethod -Uri "http://localhost:3001/api/hotmart/webhook1" -Method POST -Headers @{"Content-Type" = "application/json" } -Body $testPayload1
    Write-Host "✅ Webhook #1 processado com sucesso!" -ForegroundColor Green
    Write-Host "   Lead UUID: $($result1.lead_uuid)" -ForegroundColor Gray
    Write-Host "   Status: $($result1.status)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Erro ao processar webhook #1: $_" -ForegroundColor Red
}

# 5. Enviar payload de teste para webhook #2
Write-Host "`n5. Enviando payload de teste para webhook #2..." -ForegroundColor Yellow
$testPayload2 = @{
    event = "PURCHASE_COMPLETE"
    data  = @{
        buyer   = @{
            name  = "Teste Webhook 2"
            email = "teste.webhook2.$(Get-Date -Format 'yyyyMMddHHmmss')@hotmart.com"
            phone = "11999999992"
        }
        product = @{
            name = "Produto Teste Webhook 2"
        }
    }
} | ConvertTo-Json -Depth 10

try {
    $result2 = Invoke-RestMethod -Uri "http://localhost:3001/api/hotmart/webhook2" -Method POST -Headers @{"Content-Type" = "application/json" } -Body $testPayload2
    Write-Host "✅ Webhook #2 processado com sucesso!" -ForegroundColor Green
    Write-Host "   Lead UUID: $($result2.lead_uuid)" -ForegroundColor Gray
    Write-Host "   Status: $($result2.status)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Erro ao processar webhook #2: $_" -ForegroundColor Red
}

# 6. Verificar logs
Write-Host "`n6. Verificando logs de webhooks..." -ForegroundColor Yellow
try {
    $logs = Invoke-RestMethod -Uri "$baseUrl/hotmart/logs?limit=10" -Method GET -Headers $headers
    Write-Host "✅ Últimos logs:" -ForegroundColor Green
    foreach ($log in $logs.logs | Select-Object -First 5) {
        $webhookNum = if ($log.webhook_config_id) { "#$($log.webhook_config_id)" } else { "N/A" }
        Write-Host "   - [$($log.created_at)] Webhook $webhookNum - $($log.event_type) - $($log.status)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Erro ao buscar logs: $_" -ForegroundColor Red
}

Write-Host "`n=== TESTE CONCLUÍDO ===" -ForegroundColor Cyan
Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "1. Acesse http://localhost:5173 e vá em Configurações > Hotmart" -ForegroundColor Gray
Write-Host "2. Verifique se os webhooks aparecem corretamente" -ForegroundColor Gray
Write-Host "3. Verifique se os leads foram criados nas campanhas corretas" -ForegroundColor Gray
