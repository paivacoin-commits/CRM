# ============================================
# TESTE FINAL - API DE EXCLUSAO SEM TOKEN
# ============================================

# Escolha o ambiente:
$USE_PRODUCTION = $true  # $true para producao, $false para local

if ($USE_PRODUCTION) {
    $API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion"
    Write-Host "Ambiente: PRODUCAO (Render)" -ForegroundColor Yellow
} else {
    $API_URL = "http://localhost:3001/api/webhook/exclusion"
    Write-Host "Ambiente: LOCAL" -ForegroundColor Yellow
}

$PHONE = "5511993603015"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE API DE EXCLUSAO (SEM TOKEN)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $API_URL" -ForegroundColor Gray
Write-Host "Telefone: $PHONE" -ForegroundColor Gray
Write-Host ""

# Payload formato Hotmart
$payload = @{
    event = "PURCHASE_REFUNDED"
    data = @{
        buyer = @{
            name = "Cliente Teste Exclusao"
            email = "teste@exclusao.com"
            phone = $PHONE
            phone_number = $PHONE
        }
        purchase = @{
            transaction = "HP-REFUND-TEST-001"
            status = "refunded"
        }
        product = @{
            name = "Produto Teste"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Payload (formato Hotmart):" -ForegroundColor Cyan
Write-Host $payload -ForegroundColor DarkGray
Write-Host ""
Write-Host "Enviando requisicao SEM TOKEN..." -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers -Body $payload -ErrorAction Stop
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resposta completa:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response.results) {
        Write-Host "Resultados da Exclusao:" -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor Gray
        
        $successCount = 0
        $errorCount = 0
        
        foreach ($result in $response.results) {
            if ($result.success) {
                Write-Host "  OK - $($result.groupName)" -ForegroundColor Green
                Write-Host "       ID: $($result.groupId)" -ForegroundColor DarkGray
                $successCount++
            } else {
                Write-Host "  ERRO - $($result.groupName)" -ForegroundColor Red
                Write-Host "         Motivo: $($result.error)" -ForegroundColor Yellow
                $errorCount++
            }
        }
        
        Write-Host ""
        Write-Host "Resumo:" -ForegroundColor Cyan
        Write-Host "  Sucessos: $successCount" -ForegroundColor Green
        Write-Host "  Erros: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Gray" })
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Contato removido dos grupos!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ERRO!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status HTTP: $statusCode" -ForegroundColor Yellow
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalhes do erro:" -ForegroundColor Cyan
        try {
            $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host ($errorJson | ConvertTo-Json -Depth 10) -ForegroundColor White
        } catch {
            Write-Host $_.ErrorDetails.Message -ForegroundColor White
        }
    }
    
    Write-Host ""
    Write-Host "Possiveis causas:" -ForegroundColor Cyan
    
    switch ($statusCode) {
        403 { 
            Write-Host "  - API de exclusao esta DESABILITADA" -ForegroundColor Yellow 
            Write-Host "  - Va em Settings > Exclusion API e habilite" -ForegroundColor Yellow
        }
        400 { Write-Host "  - Telefone nao encontrado no payload" -ForegroundColor Yellow }
        404 { Write-Host "  - Endpoint nao encontrado" -ForegroundColor Yellow }
        500 { Write-Host "  - Erro interno do servidor" -ForegroundColor Yellow }
        default { Write-Host "  - Erro desconhecido (codigo $statusCode)" -ForegroundColor Yellow }
    }
}

Write-Host ""
Write-Host "Aguarde alguns minutos para o Render fazer deploy..." -ForegroundColor Cyan
Write-Host ""
