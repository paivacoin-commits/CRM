# ============================================
# TESTE COM FORMATO HOTMART REAL
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE: FORMATO HOTMART" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Formato exato que o Hotmart envia (CANCELAMENTO)
$hotmartPayload = @{
    event = "PURCHASE_CANCELED"
    data = @{
        buyer = @{
            email = "teste@example.com"
            name = "Teste Usuario"
            phone = "5511993603015"
        }
        product = @{
            id = 123456
            name = "Produto Teste"
        }
        purchase = @{
            transaction = "HP12345678"
            status = "canceled"
        }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Payload Hotmart:" -ForegroundColor Yellow
Write-Host $hotmartPayload -ForegroundColor Gray
Write-Host ""

Write-Host "Enviando para API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod `
        -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body $hotmartPayload
    
    Write-Host ""
    Write-Host "✅ RESPOSTA DA API:" -ForegroundColor Green
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host "Success: $($response.success)" -ForegroundColor Yellow
    Write-Host "Phone: $($response.phone)" -ForegroundColor White
    Write-Host ""
    
    if ($response.summary) {
        Write-Host "RESUMO:" -ForegroundColor Cyan
        Write-Host "  Total: $($response.summary.total)" -ForegroundColor White
        Write-Host "  Sucessos: $($response.summary.success)" -ForegroundColor Green
        Write-Host "  Erros: $($response.summary.errors)" -ForegroundColor Red
        Write-Host ""
    }
    
    if ($response.results) {
        Write-Host "RESULTADOS:" -ForegroundColor Cyan
        foreach ($result in $response.results | Select-Object -First 3) {
            $statusIcon = if ($result.success) { "✅" } else { "❌" }
            Write-Host "  $statusIcon $($result.groupName)" -ForegroundColor White
            if (-not $result.success) {
                Write-Host "     Erro: $($result.error)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  AGUARDE 3 SEGUNDOS..." -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Start-Sleep -Seconds 3
    
    # Verificar logs
    Write-Host ""
    Write-Host "Buscando logs salvos..." -ForegroundColor Cyan
    $logs = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=5" -Method Get
    
    Write-Host "Total de logs: $($logs.logs.Count)" -ForegroundColor Yellow
    Write-Host ""
    
    if ($logs.logs.Count -gt 0) {
        Write-Host "ÚLTIMOS LOGS:" -ForegroundColor Cyan
        foreach ($log in $logs.logs | Select-Object -First 3) {
            Write-Host "  📱 $($log.phone) - $($log.group_name)" -ForegroundColor White
            Write-Host "     Status: $($log.status)" -ForegroundColor $(if ($log.status -eq 'success') { 'Green' } else { 'Red' })
            if ($log.error_message) {
                Write-Host "     Erro: $($log.error_message)" -ForegroundColor Yellow
            }
            Write-Host ""
        }
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERRO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Detalhes do erro:" -ForegroundColor Gray
        Write-Host $_.ErrorDetails.Message -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TESTE CONCLUÍDO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
