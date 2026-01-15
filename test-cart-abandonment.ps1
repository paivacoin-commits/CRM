# Test Cart Abandonment Webhook
# Simula um evento de abandono de carrinho da Hotmart

$baseUrl = "http://localhost:3001"

$payload = @{
    event = "PURCHASE_CANCELED"
    data  = @{
        buyer    = @{
            name           = "João Silva Teste"
            email          = "joao.teste@email.com"
            phone          = "11999887766"
            checkout_phone = "11999887766"
        }
        product  = @{
            name = "Produto Teste Abandono"
        }
        purchase = @{
            transaction = "TEST-ABANDON-$(Get-Date -Format 'yyyyMMddHHmmss')"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "📤 Enviando evento de abandono de carrinho..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Payload:" -ForegroundColor Yellow
Write-Host $payload
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/cart-abandonment/webhook" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payload

    Write-Host "✅ Sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resposta:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    Write-Host ""
    Write-Host "Event ID: $($response.event_id)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "💡 Verifique os logs no Settings → Abandono de Carrinho" -ForegroundColor Magenta
}
catch {
    Write-Host "❌ Erro ao enviar webhook" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}
