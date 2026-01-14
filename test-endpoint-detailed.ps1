# Teste detalhado do endpoint
Write-Host "Testando endpoint de logs..." -ForegroundColor Cyan
Write-Host ""

try {
    # Teste 1: Endpoint de produção
    Write-Host "[1] Testando produção..." -ForegroundColor Yellow
    $prod = Invoke-WebRequest -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=10" -Method Get
    Write-Host "Status Code: $($prod.StatusCode)" -ForegroundColor Green
    
    $prodData = $prod.Content | ConvertFrom-Json
    Write-Host "Logs encontrados: $($prodData.logs.Count)" -ForegroundColor Cyan
    Write-Host ""
    
    # Teste 2: Formato da resposta
    Write-Host "[2] Formato da resposta:" -ForegroundColor Yellow
    Write-Host "Tem propriedade 'logs'? $($null -ne $prodData.logs)" -ForegroundColor $(if ($prodData.logs) { 'Green' } else { 'Red' })
    Write-Host "É um array? $($prodData.logs -is [Array])" -ForegroundColor $(if ($prodData.logs -is [Array]) { 'Green' } else { 'Red' })
    Write-Host ""
    
    # Teste 3: Estrutura de um log
    if ($prodData.logs.Count -gt 0) {
        Write-Host "[3] Estrutura do primeiro log:" -ForegroundColor Yellow
        $firstLog = $prodData.logs[0]
        Write-Host "  phone: $($firstLog.phone)" -ForegroundColor White
        Write-Host "  group_id: $($firstLog.group_id)" -ForegroundColor White
        Write-Host "  group_name: $($firstLog.group_name)" -ForegroundColor White
        Write-Host "  status: $($firstLog.status)" -ForegroundColor White
        Write-Host "  error_message: $($firstLog.error_message)" -ForegroundColor White
        Write-Host "  created_at: $($firstLog.created_at)" -ForegroundColor White
        Write-Host ""
    }
    
    # Teste 4: JSON completo
    Write-Host "[4] JSON completo (primeiros 2 logs):" -ForegroundColor Yellow
    $prodData.logs | Select-Object -First 2 | ConvertTo-Json -Depth 3
    
} catch {
    Write-Host "ERRO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Detalhes:" -ForegroundColor Gray
    Write-Host $_ -ForegroundColor DarkGray
}
