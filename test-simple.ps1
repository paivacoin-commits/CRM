$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer rxr4x5rp57i57hmlekoxnl"
}

$body = '{"phone":"5511993603015"}'

Write-Host "Testando API de Exclusao..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Resposta:" -ForegroundColor Cyan
    Write-Host $response.Content -ForegroundColor White
    
} catch {
    Write-Host "Erro: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Mensagem: $($_.Exception.Message)" -ForegroundColor Yellow
    
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $responseBody = $reader.ReadToEnd()
    
    Write-Host ""
    Write-Host "Resposta do servidor:" -ForegroundColor Cyan
    Write-Host $responseBody -ForegroundColor White
}
