# Script PowerShell para testar API de Exclusão
# Execute no PowerShell: .\test-exclusion-api.ps1

# ⚠️ CONFIGURE AQUI:
$TOKEN = "SEU_TOKEN_AQUI"  # Pegar em Settings > Exclusion API
$PHONE = "5538992632030"    # Telefone para testar
$API_URL = "http://localhost:3001/api/webhook/exclusion"

Write-Host "🧪 Testando API de Exclusão..." -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 URL: $API_URL" -ForegroundColor Gray
Write-Host "🔑 Token: $TOKEN" -ForegroundColor Gray
Write-Host "📞 Telefone: $PHONE" -ForegroundColor Gray
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $TOKEN"
}

$body = @{
    phone = $PHONE
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Post -Headers $headers -Body $body
    
    Write-Host "✅ Resposta recebida:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
    
    if ($response.results) {
        Write-Host ""
        Write-Host "📋 Resultados por grupo:" -ForegroundColor Cyan
        foreach ($result in $response.results) {
            if ($result.success) {
                Write-Host "  ✅ $($result.groupName)" -ForegroundColor Green
            } else {
                Write-Host "  ❌ $($result.groupName) - $($result.error)" -ForegroundColor Red
            }
        }
    }
    
} catch {
    Write-Host "❌ Erro ao fazer requisição:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Detalhes:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host ""
Write-Host "🏁 Teste concluído!" -ForegroundColor Cyan
