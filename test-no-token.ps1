$body = '{"phone":"5511993603015"}'

Write-Host ""
Write-Host "Testando API de Exclusao SEM TOKEN..." -ForegroundColor Cyan
Write-Host "URL: http://localhost:3001/api/webhook/exclusion" -ForegroundColor Gray
Write-Host "Telefone: 5511993603015" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/webhook/exclusion" -Method Post -Headers @{"Content-Type"="application/json"} -Body $body -ErrorAction Stop
    
    Write-Host "======================================" -ForegroundColor Green
    Write-Host "  SUCESSO!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resposta:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor White
    
} catch {
    Write-Host "======================================" -ForegroundColor Red
    Write-Host "  ERRO!" -ForegroundColor Red
    Write-Host "======================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    
    Write-Host "Resposta:" -ForegroundColor Cyan
    Write-Host $responseBody -ForegroundColor White
}

Write-Host ""
