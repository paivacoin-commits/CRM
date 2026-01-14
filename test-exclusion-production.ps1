# Teste da API de Exclusao - Producao (Render)
# Simula webhook da Hotmart com pedido de reembolso

$API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion"
$PHONE = "5511993603015"

Write-Host "Testando API de Exclusao (PRODUCAO)" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $API_URL" -ForegroundColor Yellow
Write-Host "Telefone: $PHONE" -ForegroundColor Yellow
Write-Host "Formato: Hotmart Webhook" -ForegroundColor Yellow
Write-Host ""

# Payload simulando webhook da Hotmart
$body = @{
    event = "PURCHASE_REFUNDED"
    data = @{
        buyer = @{
            name = "Teste Exclusao"
            email = "teste@exclusao.com"
            phone = $PHONE
            phone_number = $PHONE
        }
        purchase = @{
            transaction = "TEST-EXCLUSION-001"
            status = "refunded"
        }
        product = @{
            name = "Produto Teste"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Payload enviado:" -ForegroundColor Cyan
Write-Host $body -ForegroundColor Gray
Write-Host ""
Write-Host "Enviando requisicao..." -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "SUCESSO! Resposta recebida:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    
    if ($response.results) {
        Write-Host ""
        Write-Host "Resultados da Exclusao:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            if ($result.success) {
                Write-Host "  OK - Grupo: $($result.groupName)" -ForegroundColor Green
            } else {
                Write-Host "  ERRO - Grupo: $($result.groupName) - $($result.error)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Teste concluido com SUCESSO!" -ForegroundColor Green
    
} catch {
    Write-Host "ERRO na requisicao!" -ForegroundColor Red
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Detalhes do erro:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Fim do teste" -ForegroundColor Cyan
