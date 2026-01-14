$response = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"phone":"5511993603015"}'

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  RESULTADO DO TESTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Status: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
Write-Host "Mensagem: $($response.message)" -ForegroundColor Cyan
Write-Host "Telefone: $($response.phone)" -ForegroundColor Yellow
Write-Host ""

Write-Host "RESUMO:" -ForegroundColor Cyan
Write-Host "  Total: $($response.summary.total)" -ForegroundColor White
Write-Host "  Sucessos: $($response.summary.success)" -ForegroundColor Green
Write-Host "  Erros: $($response.summary.errors)" -ForegroundColor Red
Write-Host ""

Write-Host "DETALHES POR GRUPO:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

$i = 1
foreach ($result in $response.results) {
    if ($result.success) {
        Write-Host "[$i] OK - $($result.groupName)" -ForegroundColor Green
    } else {
        Write-Host "[$i] ERRO - $($result.groupName)" -ForegroundColor Red
        Write-Host "    Motivo: $($result.error)" -ForegroundColor Yellow
        if ($result.details) {
            Write-Host "    Detalhes: $($result.details)" -ForegroundColor DarkYellow
        }
    }
    $i++
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Log salvo no banco de dados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
