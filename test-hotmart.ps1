$payload = '{"event":"PURCHASE_CANCELED","data":{"buyer":{"email":"teste@example.com","name":"Teste Usuario","phone":"5511993603015"},"product":{"id":123456,"name":"Produto Teste"},"purchase":{"transaction":"HP12345678","status":"canceled"}}}'

Write-Host "Enviando payload Hotmart..." -ForegroundColor Cyan
Write-Host $payload -ForegroundColor Gray
Write-Host ""

$response = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" -Method Post -Headers @{"Content-Type"="application/json"} -Body $payload

Write-Host "Resposta:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "Aguardando 3 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Buscando logs..." -ForegroundColor Cyan
$logs = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=5" -Method Get

Write-Host "Total de logs: $($logs.logs.Count)" -ForegroundColor Yellow
$logs.logs | Select-Object -First 3 | Format-Table phone, group_name, status, error_message -AutoSize
