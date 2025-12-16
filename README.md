# 🚀 Sales Recovery CRM

Sistema de CRM para gestão de vendas e recuperação de leads, desenvolvido com React + Node.js + Supabase.

## 📋 Funcionalidades

### 👥 Gestão de Leads
- Cadastro e importação de leads (CSV/JSON)
- Distribuição automática round-robin para vendedoras
- Filtros por status, campanha, vendedora e grupo
- Atualização de status em tempo real
- Histórico de observações
- Marcação "no grupo" / "fora do grupo"

### 📊 Dashboard
- Visão geral de métricas
- Taxa de conversão
- Performance por vendedora (admin)
- Leads recentes

### 👤 Gestão de Usuários
- Perfis: Admin e Vendedora
- Controle de distribuição de leads
- Ativação/desativação de usuários

### 📁 Campanhas
- Criação e gerenciamento de campanhas
- Arquivamento e exclusão
- Vinculação de leads a campanhas

### ⚙️ Configurações
- Status personalizáveis com cores
- Integração webhook Hotmart
- Exportação de leads (CSV/JSON)
- Importação em massa com mapeamento
- Histórico de importações com reversão

## 🛠️ Tecnologias

- **Frontend**: React + Vite + Lucide Icons
- **Backend**: Node.js + Express
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: JWT + bcrypt

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/sales-recovery-crm.git
cd sales-recovery-crm
```

### 2. Configure o Supabase
1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o SQL do arquivo `backend/src/database/supabase-schema.sql` no SQL Editor
3. Desabilite o RLS nas tabelas (ou configure políticas)

### 3. Configure o Backend
```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas credenciais do Supabase
```

### 4. Configure o Frontend
```bash
cd frontend
npm install
```

### 5. Inicie os servidores
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 6. Acesse
- Frontend: http://localhost:5173
- API: http://localhost:3001

## 🔐 Credenciais Padrão

Após executar o schema SQL, um usuário admin é criado:
- **Email**: admin@crm.com
- **Senha**: admin123

## 📁 Estrutura do Projeto

```
sales-recovery-crm/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   ├── supabase.js      # Cliente Supabase
│   │   │   └── supabase-schema.sql
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── campaigns.js
│   │   │   ├── dashboard.js
│   │   │   ├── imports.js
│   │   │   ├── leads.js
│   │   │   ├── settings.js
│   │   │   ├── statuses.js
│   │   │   ├── users.js
│   │   │   └── webhook.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Campaigns.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Leads.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Users.jsx
│   │   ├── components/
│   │   │   └── Layout.jsx
│   │   ├── api.js
│   │   ├── AuthContext.jsx
│   │   └── App.jsx
│   └── package.json
└── README.md
```

## 🔗 Webhook Hotmart

Configure o webhook da Hotmart para:
```
POST https://seu-dominio.com/api/webhook/hotmart
```

## 📝 Licença

MIT License
