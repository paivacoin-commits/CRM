$response = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" -Method Post -Headers @{"Content-Type"="application/json"} -Body '{"phone":"5511993603015"}'

Write-Host "RESPOSTA COMPLETA:" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
$response | ConvertTo-Json -Depth 10
