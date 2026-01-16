# Script para aplicar migration de Round-Robin por webhook
# Execute este script para aplicar a migration no Supabase

Write-Host "🔄 Aplicando migration: Round-Robin por webhook" -ForegroundColor Cyan
Write-Host ""

# Ler o arquivo SQL
$sqlFile = "database\migrations\011_webhook_round_robin.sql"
$sqlContent = Get-Content $sqlFile -Raw

Write-Host "📄 SQL a ser executado:" -ForegroundColor Yellow
Write-Host $sqlContent
Write-Host ""

Write-Host "⚠️  IMPORTANTE: Execute este SQL no painel do Supabase" -ForegroundColor Yellow
Write-Host "1. Acesse: https://supabase.com/dashboard/project/otgfcogtttydrmpfcukl/editor" -ForegroundColor White
Write-Host "2. Clique em 'SQL Editor'" -ForegroundColor White
Write-Host "3. Cole o SQL acima" -ForegroundColor White
Write-Host "4. Clique em 'Run'" -ForegroundColor White
Write-Host ""

# Copiar SQL para clipboard
$sqlContent | Set-Clipboard
Write-Host "✅ SQL copiado para a área de transferência!" -ForegroundColor Green
Write-Host ""

Write-Host "Pressione qualquer tecla após executar a migration no Supabase..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "✅ Migration aplicada! Reiniciando servidor..." -ForegroundColor Green
