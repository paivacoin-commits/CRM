# ============================================
# TESTE DA API DE EXCLUSAO - PRODUCAO
# ============================================
# 
# INSTRUCOES:
# 1. Pegue o token em Settings > Exclusion API
# 2. Cole o token na variavel $TOKEN abaixo
# 3. Execute: .\test-exclusion-with-token.ps1
#

# ⚠️ CONFIGURE O TOKEN AQUI:
$TOKEN = "COLE_SEU_TOKEN_AQUI"

# Configuracoes
$API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion"
$PHONE = "5511993603015"  # 55 11 99360-3015

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE API DE EXCLUSAO - PRODUCAO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $API_URL" -ForegroundColor Gray
Write-Host "Telefone: $PHONE" -ForegroundColor Gray
Write-Host "Token: $($TOKEN.Substring(0, [Math]::Min(10, $TOKEN.Length)))..." -ForegroundColor Gray
Write-Host ""

# Validar token
if ($TOKEN -eq "COLE_SEU_TOKEN_AQUI" -or [string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "ERRO: Token nao configurado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Acesse Settings > Exclusion API" -ForegroundColor Yellow
    Write-Host "2. Copie o token" -ForegroundColor Yellow
    Write-Host "3. Cole na variavel TOKEN deste script" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Payload formato Hotmart (reembolso)
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
            name = "Produto Teste Exclusao"
        }
    }
} | ConvertTo-Json -Depth 10

Write-Host "Payload (formato Hotmart):" -ForegroundColor Cyan
Write-Host $payload -ForegroundColor DarkGray
Write-Host ""
Write-Host "Enviando requisicao..." -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $TOKEN"
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
        Write-Host "Resultados por grupo:" -ForegroundColor Cyan
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
    Write-Host "  Teste concluido!" -ForegroundColor Green
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
        401 { Write-Host "  - Token invalido ou expirado" -ForegroundColor Yellow }
        403 { Write-Host "  - API de exclusao desabilitada" -ForegroundColor Yellow }
        400 { Write-Host "  - Formato do payload incorreto" -ForegroundColor Yellow }
        404 { Write-Host "  - Endpoint nao encontrado" -ForegroundColor Yellow }
        500 { Write-Host "  - Erro interno do servidor" -ForegroundColor Yellow }
        default { Write-Host "  - Erro desconhecido" -ForegroundColor Yellow }
    }
}

Write-Host ""
