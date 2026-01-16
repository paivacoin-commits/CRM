# Test Cart Abandonment API in Production
# Testa se a rota existe no backend de produção

$productionUrl = "https://crmsales-recovery-crm-api.onrender.com"
$token = Read-Host "Cole o token de autenticação (localStorage.getItem('token'))"

Write-Host "`n🔍 Testando endpoint de cart abandonment em produção...`n" -ForegroundColor Cyan

# Test 1: Health check
Write-Host "1️⃣ Testando health check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$productionUrl/api/health" -Method GET
    Write-Host "✅ Backend está online!" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Backend offline ou inacessível!" -ForegroundColor Red
    Write-Host "   Erro: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# Test 2: Cart Abandonment Settings (sem auth)
Write-Host "`n2️⃣ Testando cart-abandonment/settings SEM autenticação..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$productionUrl/api/cart-abandonment/settings" -Method GET -ErrorAction Stop
    Write-Host "✅ Rota existe!" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Gray
}
catch {
    Write-Host "⚠️ Erro esperado (sem auth):" -ForegroundColor Yellow
    Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Gray
    Write-Host "   Mensagem: $($_.Exception.Message)" -ForegroundColor Gray
}

# Test 3: Cart Abandonment Settings (com auth)
if ($token) {
    Write-Host "`n3️⃣ Testando cart-abandonment/settings COM autenticação..." -ForegroundColor Yellow
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $settings = Invoke-RestMethod -Uri "$productionUrl/api/cart-abandonment/settings" -Method GET -Headers $headers
        Write-Host "✅ Autenticação funcionou!" -ForegroundColor Green
        Write-Host "   Settings:" -ForegroundColor Gray
        $settings | ConvertTo-Json -Depth 3
    }
    catch {
        Write-Host "❌ Erro ao buscar settings:" -ForegroundColor Red
        Write-Host "   Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Mensagem: $($_.Exception.Message)" -ForegroundColor Red
        
        # Tentar ler o corpo da resposta
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "`n   Resposta do servidor:" -ForegroundColor Yellow
            Write-Host "   $($responseBody.Substring(0, [Math]::Min(500, $responseBody.Length)))" -ForegroundColor Gray
        }
        catch {}
    }
}

Write-Host "`n✅ Teste concluído!`n" -ForegroundColor Cyan
