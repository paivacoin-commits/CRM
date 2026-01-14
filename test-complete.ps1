# ============================================
# TESTE COMPLETO - API + VERIFICAÇÃO DE LOGS
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 1: ENVIAR TESTE DE EXCLUSÃO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $exclusionResponse = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" `
        -Method Post `
        -Headers @{"Content-Type"="application/json"} `
        -Body '{"phone":"5511993603015"}'
    
    Write-Host "✅ Teste enviado com sucesso!" -ForegroundColor Green
    Write-Host "Status: $($exclusionResponse.success)" -ForegroundColor Yellow
    Write-Host "Total processado: $($exclusionResponse.summary.total)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "❌ Erro ao enviar teste:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 2: AGUARDAR 3 SEGUNDOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASSO 3: BUSCAR LOGS DO BANCO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    $logsResponse = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=10" -Method Get
    
    if ($logsResponse.logs -and $logsResponse.logs.Count -gt 0) {
        Write-Host "✅ LOGS ENCONTRADOS: $($logsResponse.logs.Count)" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "ÚLTIMOS 5 LOGS:" -ForegroundColor Yellow
        Write-Host "----------------------------------------" -ForegroundColor Gray
        
        foreach ($log in $logsResponse.logs | Select-Object -First 5) {
            $statusColor = if ($log.status -eq 'success') { 'Green' } else { 'Red' }
            $statusText = if ($log.status -eq 'success') { 'SUCESSO' } else { 'ERRO' }
            
            Write-Host "📱 Telefone: $($log.phone)" -ForegroundColor White
            Write-Host "   Grupo: $($log.group_name)" -ForegroundColor Cyan
            Write-Host "   Status: $statusText" -ForegroundColor $statusColor
            if ($log.error_message) {
                Write-Host "   Motivo: $($log.error_message)" -ForegroundColor Yellow
            }
            Write-Host "   Data: $($log.created_at)" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "❌ NENHUM LOG ENCONTRADO!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Resposta do servidor:" -ForegroundColor Yellow
        $logsResponse | ConvertTo-Json -Depth 3
    }
} catch {
    Write-Host "❌ Erro ao buscar logs:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TESTE CONCLUÍDO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Agora vá em Settings > API de Exclusão" -ForegroundColor Cyan
Write-Host "e verifique se os logs aparecem!" -ForegroundColor Cyan
Write-Host ""
