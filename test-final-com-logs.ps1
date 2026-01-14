# TESTE FINAL - API DE EXCLUSAO COM LOGS
# Aguarde 2-3 minutos apos o push para o Render fazer deploy

$API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion"
$PHONE = "5511993603015"  # Mesmo numero do teste anterior

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE API DE EXCLUSAO + LOGS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "URL: $API_URL" -ForegroundColor Gray
Write-Host "Telefone: $PHONE" -ForegroundColor Gray
Write-Host ""
Write-Host "Enviando requisicao..." -ForegroundColor Yellow
Write-Host ""

$payload = '{"phone":"' + $PHONE + '"}'

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload -ErrorAction Stop
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  SUCESSO!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "Telefone processado: $($response.phone)" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "RESUMO:" -ForegroundColor Cyan
    Write-Host "  Total de grupos: $($response.summary.total)" -ForegroundColor White
    Write-Host "  Sucessos: $($response.summary.success)" -ForegroundColor Green
    Write-Host "  Erros: $($response.summary.errors)" -ForegroundColor $(if ($response.summary.errors -gt 0) { "Red" } else { "Gray" })
    Write-Host ""
    
    if ($response.results) {
        Write-Host "DETALHES POR GRUPO:" -ForegroundColor Cyan
        Write-Host "----------------------------------------" -ForegroundColor Gray
        
        $count = 0
        foreach ($result in $response.results) {
            $count++
            
            if ($result.success) {
                Write-Host "  [$count] OK - $($result.groupName)" -ForegroundColor Green
                Write-Host "       $($result.message)" -ForegroundColor DarkGray
            } else {
                Write-Host "  [$count] ERRO - $($result.groupName)" -ForegroundColor Red
                Write-Host "       Motivo: $($result.error)" -ForegroundColor Yellow
                if ($result.details) {
                    Write-Host "       Detalhes: $($result.details)" -ForegroundColor DarkYellow
                }
            }
            Write-Host ""
        }
    }
    
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Log salvo no banco de dados!" -ForegroundColor Green
    Write-Host "  Verifique em Settings > Logs de Exclusao" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ERRO!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status HTTP: $statusCode" -ForegroundColor Yellow
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Detalhes:" -ForegroundColor Cyan
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
}

Write-Host ""
