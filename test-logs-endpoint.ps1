# Teste direto do endpoint de logs
Write-Host "Testando endpoint de logs..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=10" -Method Get
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  RESPOSTA DO ENDPOINT" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    if ($response.logs) {
        Write-Host "Total de logs: $($response.logs.Count)" -ForegroundColor Yellow
        Write-Host ""
        
        if ($response.logs.Count -gt 0) {
            Write-Host "ÚLTIMOS LOGS:" -ForegroundColor Cyan
            foreach ($log in $response.logs | Select-Object -First 5) {
                Write-Host "  - Telefone: $($log.phone)" -ForegroundColor White
                Write-Host "    Grupo: $($log.group_name)" -ForegroundColor Gray
                Write-Host "    Status: $($log.status)" -ForegroundColor $(if ($log.status -eq 'success') { 'Green' } else { 'Red' })
                if ($log.error_message) {
                    Write-Host "    Erro: $($log.error_message)" -ForegroundColor Yellow
                }
                Write-Host "    Data: $($log.created_at)" -ForegroundColor Gray
                Write-Host ""
            }
        } else {
            Write-Host "Nenhum log encontrado no banco de dados!" -ForegroundColor Red
        }
    } else {
        Write-Host "Resposta não contém 'logs'!" -ForegroundColor Red
        Write-Host "Resposta completa:" -ForegroundColor Yellow
        $response | ConvertTo-Json -Depth 5
    }
} catch {
    Write-Host ""
    Write-Host "ERRO ao chamar endpoint:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Detalhes:" -ForegroundColor Gray
    Write-Host $_ -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
