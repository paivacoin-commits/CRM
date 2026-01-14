# Script para obter o token de exclusao das configuracoes

$API_URL = "https://crmsales-recovery-crm-api.onrender.com/api/settings/api"

Write-Host "Buscando configuracoes da API..." -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $API_URL -Method Get -ErrorAction Stop
    
    Write-Host "Configuracoes encontradas:" -ForegroundColor Green
    Write-Host ""
    Write-Host "Exclusion Enabled: $($response.exclusion_enabled)" -ForegroundColor Yellow
    Write-Host "Exclusion Token: $($response.exclusion_token)" -ForegroundColor Green
    Write-Host ""
    
    if ($response.exclusion_group_ids) {
        Write-Host "Grupos configurados: $($response.exclusion_group_ids.Count)" -ForegroundColor Cyan
    }
    
    if ($response.exclusion_token) {
        Write-Host ""
        Write-Host "Use este token para testar:" -ForegroundColor Cyan
        Write-Host $response.exclusion_token -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "AVISO: Nenhum token configurado!" -ForegroundColor Red
        Write-Host "Acesse as configuracoes do sistema para gerar um token." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Erro ao buscar configuracoes:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}
