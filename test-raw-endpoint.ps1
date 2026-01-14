# Teste direto do endpoint com detalhes
Write-Host "Testando endpoint /api/exclusion-logs..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=10" -Method Get -UseBasicParsing
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Raw Response:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor White
    Write-Host ""
    
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "Parsed Data:" -ForegroundColor Cyan
    Write-Host "  Has 'logs' property: $($null -ne $data.logs)" -ForegroundColor Yellow
    Write-Host "  Logs count: $($data.logs.Count)" -ForegroundColor Yellow
    Write-Host ""
    
    if ($data.logs -and $data.logs.Count -gt 0) {
        Write-Host "First log structure:" -ForegroundColor Green
        $data.logs[0] | ConvertTo-Json -Depth 3
    } else {
        Write-Host "NO LOGS FOUND!" -ForegroundColor Red
    }
    
} catch {
    Write-Host "ERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}
