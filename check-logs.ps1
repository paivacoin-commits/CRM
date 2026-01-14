Write-Host "Buscando logs..." -ForegroundColor Cyan

$logs = Invoke-RestMethod -Uri "https://crmsales-recovery-crm-api.onrender.com/api/exclusion-logs?limit=10" -Method Get

Write-Host ""
Write-Host "Total de logs: $($logs.logs.Count)" -ForegroundColor Yellow
Write-Host ""

if ($logs.logs.Count -gt 0) {
    foreach ($log in $logs.logs | Select-Object -First 5) {
        Write-Host "Telefone: $($log.phone)" -ForegroundColor White
        Write-Host "Grupo: $($log.group_name)" -ForegroundColor Cyan
        Write-Host "Status: $($log.status)" -ForegroundColor $(if ($log.status -eq 'success') { 'Green' } else { 'Red' })
        if ($log.error_message) {
            Write-Host "Erro: $($log.error_message)" -ForegroundColor Yellow
        }
        Write-Host ""
    }
} else {
    Write-Host "Nenhum log encontrado!" -ForegroundColor Red
}
