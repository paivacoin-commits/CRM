# TESTE DA API DE EXCLUSAO - COM TOKEN
$TOKEN = "rxr4x5rp57i57hmlekoxnl"
$API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion"
$PHONE = "5511993603015"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  TESTE API DE EXCLUSAO" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $API_URL" -ForegroundColor Gray
Write-Host "Telefone: $PHONE" -ForegroundColor Gray
Write-Host "Token: $($TOKEN.Substring(0, 10))..." -ForegroundColor Gray
Write-Host ""

$payload = @{
    event = "PURCHASE_REFUNDED"
    data = @{
        buyer = @{
            name = "Cliente Teste"
            email = "teste@exclusao.com"
            phone = $PHONE
            phone_number = $PHONE
        }
        purchase = @{
            transaction = "HP-TEST-001"
            status = "refunded"
        }
        product = @{
            name = "Produto Teste"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Enviando requisicao..." -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $TOKEN"
}

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers -Body $payload -ErrorAction Stop
    
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  SUCESSO!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response.results) {
        Write-Host "Resultados:" -ForegroundColor Cyan
        Write-Host "--------------------------------------" -ForegroundColor Gray
        
        foreach ($result in $response.results) {
            if ($result.success) {
                Write-Host "  OK - $($result.groupName)" -ForegroundColor Green
            } else {
                Write-Host "  ERRO - $($result.groupName): $($result.error)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Teste concluido!" -ForegroundColor Green
    
} catch {
    Write-Host "======================================" -ForegroundColor Red
    Write-Host "  ERRO!" -ForegroundColor Red
    Write-Host "======================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Detalhes:" -ForegroundColor Cyan
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
}

Write-Host ""
