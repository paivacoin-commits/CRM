# Guia de Uso - Múltiplos Webhooks Hotmart

## Visão Geral

O sistema agora suporta múltiplos webhooks do Hotmart, permitindo que você configure diferentes URLs para receber leads de diferentes produtos/campanhas.

## Como Funciona

### URLs Sequenciais

Cada webhook criado recebe um número sequencial:
- Primeiro webhook: `https://crm-recovery.vercel.app/api/hotmart/webhook1`
- Segundo webhook: `https://crm-recovery.vercel.app/api/hotmart/webhook2`
- Terceiro webhook: `https://crm-recovery.vercel.app/api/hotmart/webhook3`
- E assim por diante...

### Configuração por Webhook

Cada webhook pode ter:
- **Campanha específica**: Leads recebidos neste webhook serão automaticamente atribuídos à campanha selecionada
- **Webhook Secret**: Token opcional para validar a autenticidade dos webhooks
- **Status Ativo/Inativo**: Habilitar ou desabilitar o webhook sem deletá-lo

## Passo a Passo

### 1. Criar Novo Webhook

1. Acesse **Configurações → Hotmart**
2. Clique em **"Criar Novo Webhook"**
3. Um novo webhook será criado automaticamente com o próximo número disponível
4. Configure a campanha desejada no dropdown
5. (Opcional) Gere um webhook secret para segurança
6. A URL será gerada automaticamente: `webhook1`, `webhook2`, etc.

### 2. Configurar no Hotmart

1. Acesse o painel da Hotmart
2. Vá em **Ferramentas → Webhooks**
3. Adicione a URL do webhook específico para cada produto
   - Produto A → `https://crm-recovery.vercel.app/api/hotmart/webhook1`
   - Produto B → `https://crm-recovery.vercel.app/api/hotmart/webhook2`
4. Selecione os eventos: `PURCHASE_COMPLETE` e `PURCHASE_APPROVED`

### 3. Testar Webhook

Use o script de teste:
```powershell
.\test-hotmart-multiple.ps1
```

Ou teste manualmente enviando um POST para a URL do webhook:
```powershell
$payload = @{
    event = "PURCHASE_COMPLETE"
    data = @{
        buyer = @{
            name = "João Silva"
            email = "joao@example.com"
            phone = "11999999999"
        }
        product = @{
            name = "Meu Produto"
        }
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:3001/api/hotmart/webhook1" -Method POST -Body $payload -ContentType "application/json"
```

### 4. Monitorar Logs

Na seção **"Log de Atividades"**, você verá:
- Qual webhook recebeu cada evento (coluna "Webhook")
- Status do processamento
- Dados do comprador
- Produto comprado

## Exemplo de Uso

### Cenário: Dois Produtos do Hotmart

**Produto 1: "Curso de Marketing"**
- Webhook: `webhook1`
- Campanha no CRM: "Marketing Digital 2026"

**Produto 2: "Mentoria VIP"**
- Webhook: `webhook2`
- Campanha no CRM: "Mentoria Exclusiva"

Quando alguém comprar:
- **Curso de Marketing** → Lead criado automaticamente na campanha "Marketing Digital 2026"
- **Mentoria VIP** → Lead criado automaticamente na campanha "Mentoria Exclusiva"

## Configurações Globais

### Distribuição Round-Robin

Se ativada, os leads recebidos por **qualquer webhook** serão distribuídos automaticamente entre as vendedoras ativas, seguindo a ordem de distribuição configurada.

## Gerenciamento de Webhooks

### Editar Webhook

- Altere a campanha a qualquer momento
- Atualize o webhook secret
- As mudanças são salvas automaticamente

### Desativar Webhook

- Desmarque a opção "Ativo"
- O webhook continuará existindo, mas rejeitará requisições
- Útil para pausar temporariamente sem perder a configuração

### Deletar Webhook

- Clique no ícone de lixeira
- Confirme a exclusão
- **Atenção**: Os logs históricos serão mantidos, mas o webhook não poderá mais receber requisições

## Migração de Dados

Se você já tinha uma configuração antiga do Hotmart:
- A migração criará automaticamente um `webhook1` com sua campanha padrão anterior
- Você pode continuar usando este webhook ou criar novos

## Troubleshooting

### Webhook não está recebendo leads

1. Verifique se o webhook está **Ativo**
2. Confirme que a URL no painel do Hotmart está correta
3. Verifique os logs para ver se há erros
4. Teste com o script `test-hotmart-multiple.ps1`

### Leads indo para campanha errada

1. Verifique qual webhook está configurado no Hotmart
2. Confirme a campanha selecionada para aquele webhook no CRM
3. Verifique os logs para ver qual webhook processou o lead

### Erro 404 ao receber webhook

- Certifique-se de que o número do webhook existe
- Exemplo: Se você só tem `webhook1` e `webhook2`, não use `webhook3`

## SQL de Migração

Para criar as tabelas necessárias no Supabase, execute:

```sql
-- Ver arquivo: database/migrations/010_hotmart_multiple_webhooks.sql
```

## Suporte

Para problemas ou dúvidas, verifique:
1. Logs de atividades na interface
2. Console do navegador (F12)
3. Logs do servidor backend
