# 🔥 COMO TESTAR A API DE EXCLUSÃO COM HOTMART

## 📋 **INFORMAÇÕES NECESSÁRIAS:**

### URL do Webhook:
```
https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion
```

### Token (Opcional):
- A API funciona **SEM token** (opcional)
- Se quiser usar token, pegue em Settings > Exclusão

---

## 🎯 **PASSO A PASSO - TESTE NA HOTMART:**

### 1. Acesse a Hotmart
1. Faça login em: https://app.hotmart.com
2. Vá em **Ferramentas** > **Webhooks**

### 2. Configure o Webhook de Exclusão
1. Clique em **"Novo Webhook"** ou **"Adicionar Webhook"**
2. Preencha os campos:

   **Nome:** `Exclusão de Grupos WhatsApp`
   
   **URL:** `https://crmsales-recovery-crm-api.onrender.com/api/webhook/exclusion`
   
   **Eventos a monitorar:**
   - ✅ `PURCHASE_CANCELED` (Compra Cancelada)
   - ✅ `PURCHASE_REFUNDED` (Compra Reembolsada)
   - ✅ `PURCHASE_CHARGEBACK` (Chargeback)
   - ✅ `SUBSCRIPTION_CANCELLATION` (Cancelamento de Assinatura)
   
   **Versão:** `2.0.0` (recomendado)
   
   **Método:** `POST`
   
   **Headers (Opcional):**
   - Se quiser usar token:
     - Header: `Authorization`
     - Value: `Bearer SEU_TOKEN_AQUI`

3. Clique em **"Salvar"**

### 3. Testar o Webhook
1. Na lista de webhooks, encontre o que você criou
2. Clique em **"Testar"** ou **"Enviar Teste"**
3. A Hotmart enviará um payload de teste para sua API

### 4. Verificar os Logs
1. Vá em **Settings > Exclusão** no seu CRM
2. Role até **"Logs de Exclusão (Últimas Ações)"**
3. Você verá um novo log com:
   - Telefone do teste
   - Grupos processados
   - Status (sucesso/erro)
   - Horário

---

## 📱 **FORMATO DO TELEFONE:**

A Hotmart envia o telefone em:
- `data.buyer.phone` (formato principal)
- `data.buyer.checkout_phone` (alternativo)

**Exemplo de payload da Hotmart:**
```json
{
  "event": "PURCHASE_CANCELED",
  "data": {
    "buyer": {
      "name": "João Silva",
      "email": "joao@example.com",
      "phone": "5511999999999",
      "checkout_phone": "11999999999"
    },
    "product": {
      "name": "Produto Teste"
    }
  }
}
```

---

## ✅ **O QUE ACONTECE:**

1. Hotmart envia o webhook de cancelamento
2. Sua API recebe e extrai o telefone
3. Normaliza o telefone (remove caracteres especiais)
4. Remove o contato dos grupos configurados
5. **Salva o log no banco de dados**
6. **Exibe na tela em Settings > Exclusão**

---

## 🔍 **VERIFICAR SE FUNCIONOU:**

### No Console do Backend (Render):
```
🗑️ Exclusion Webhook received
📞 Telefone para exclusão: 5511999999999
🎯 Grupos alvo: 8 grupos
✅ Removido do grupo: 🚨 ÚLTIMAS 2 VAGAS 🚨 #400
```

### No Frontend (Settings > Exclusão):
- Novo log aparecerá na tabela
- Telefone, grupo, status e horário visíveis
- Atualização automática a cada 5 segundos

---

## 🎬 **TESTE REAL COM CLIENTE:**

Se quiser testar com um cliente real:

1. **Faça uma compra de teste** na Hotmart
2. **Cancele a compra** (ou peça reembolso)
3. A Hotmart enviará automaticamente o webhook
4. O cliente será removido dos grupos
5. Verifique os logs em Settings > Exclusão

---

## 📊 **EVENTOS SUPORTADOS:**

| Evento Hotmart | Descrição | Ação |
|----------------|-----------|------|
| `PURCHASE_CANCELED` | Compra cancelada | Remove dos grupos |
| `PURCHASE_REFUNDED` | Reembolso | Remove dos grupos |
| `PURCHASE_CHARGEBACK` | Chargeback | Remove dos grupos |
| `SUBSCRIPTION_CANCELLATION` | Cancelamento de assinatura | Remove dos grupos |

---

## ⚠️ **IMPORTANTE:**

- ✅ A API funciona **sem token** (mais fácil para testar)
- ✅ Aceita telefone em **vários formatos** (com/sem DDI, com/sem caracteres)
- ✅ Processa **múltiplos grupos** simultaneamente
- ✅ **Salva logs** de todas as tentativas (sucesso e erro)
- ✅ **Atualização automática** na tela a cada 5 segundos

---

## 🎯 **PRONTO PARA TESTAR!**

Agora é só:
1. Configurar o webhook na Hotmart
2. Clicar em "Testar"
3. Ver o log aparecer em Settings > Exclusão

**Boa sorte com o teste!** 🚀
