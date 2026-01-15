# Teste local do endpoint de exclusão
Write-Host "Testando endpoint de exclusão local..." -ForegroundColor Cyan
Write-Host ""

$payload = @{
    event = "PURCHASE_APPROVED"
    data  = @{
        buyer   = @{
            name           = "Teste Local"
            email          = "teste@local.com"
            phone          = "5511993603015"
            checkout_phone = "11993603015"
        }
        product = @{
            name = "Produto Teste"
        }
    }
} | ConvertTo-Json -Depth 5

Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $payload -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod `
        -Uri "http://localhost:3001/api/webhook/exclusion" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json" } `
        -Body $payload
    
    Write-Host "✅ SUCESSO!" -ForegroundColor Green
    Write-Host ""
    $response | ConvertTo-Json -Depth 5
    
}
catch {
    Write-Host "❌ ERRO:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    
    if ($_.ErrorDetails) {
        Write-Host ""
        Write-Host "Detalhes:" -ForegroundColor Gray
        Write-Host $_.ErrorDetails.Message -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Verifique o console do backend para ver os logs detalhados!" -ForegroundColor Cyan
