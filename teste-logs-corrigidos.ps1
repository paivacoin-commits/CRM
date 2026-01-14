# ============================================
# TESTE FINAL - VERIFICAR LOGS NO BANCO
# ============================================
# Aguarde 2-3 minutos para o deploy

Start-Sleep -Seconds 120

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE COM LOGS CORRIGIDOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$response = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"phone":"5511993603015"}'

Write-Host "Status: $($response.success)" -ForegroundColor Green
Write-Host "Telefone: $($response.phone)" -ForegroundColor Yellow
Write-Host ""

Write-Host "RESUMO:" -ForegroundColor Cyan
Write-Host "  Total: $($response.summary.total)" -ForegroundColor White
Write-Host "  Sucessos: $($response.summary.success)" -ForegroundColor Green
Write-Host "  Erros: $($response.summary.errors)" -ForegroundColor Red
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AGORA VERIFIQUE OS LOGS!" -ForegroundColor Green
Write-Host "  Settings > Logs de Exclusao" -ForegroundColor Green
Write-Host "  Devem aparecer $($response.summary.total) registros" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
