/**
 * Sales Recovery CRM - Backend API
 * Versão Supabase (PostgreSQL na nuvem)
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente PRIMEIRO
dotenv.config();

// Importar cliente Supabase e rotas
import { initializeDatabase } from './database/supabase.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhook.js';
import leadsRoutes from './routes/leads.js';
import usersRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import campaignsRoutes from './routes/campaigns.js';
import subcampaignsRoutes from './routes/subcampaigns.js';
import schedulesRoutes from './routes/schedules.js';
import importsRoutes from './routes/imports.js';
import statusesRoutes from './routes/statuses.js';
import whatsappTemplatesRoutes from './routes/whatsappTemplates.js';
import whatsappGroupsRoutes from './routes/whatsappGroups.js';
import wappiRoutes from './routes/wappi.js';
import groupSyncRoutes from './routes/groupSync.js';
import hotmartRoutes from './routes/hotmart.js';
import exclusionLogsRoutes from './routes/exclusionLogs.js';
import cartAbandonmentRoutes from './routes/cartAbandonment.js';
import { restoreSessions } from './services/whatsappService.js';

const PORT = process.env.PORT || 3001;

// Inicializar conexão com Supabase
initializeDatabase();

const app = express();

// Configurar CORS para permitir Vercel
const allowedOrigins = [
    'http://localhost:5173',
    'https://crm-recovery.vercel.app',
    'https://crmsales-recovery-crm-api.onrender.com'
];

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, curl, etc)
        if (!origin) return callback(null, true);

        // Verificar se está na lista de origens permitidas
        if (allowedOrigins.indexOf(origin) !== -1) {
            return callback(null, true);
        }

        // Permitir qualquer subdomínio do Vercel (preview deployments)
        if (origin.endsWith('.vercel.app')) {
            return callback(null, true);
        }

        console.log('❌ CORS bloqueado para:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rotas
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.get('/ping', (req, res) => res.send('pong')); // Keep-alive endpoint
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/subcampaigns', subcampaignsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/imports', importsRoutes);
app.use('/api/statuses', statusesRoutes);
app.use('/api/whatsapp-templates', whatsappTemplatesRoutes);
app.use('/api/whatsapp-groups', whatsappGroupsRoutes);
app.use('/api/wappi', wappiRoutes);
app.use('/api/group-sync', groupSyncRoutes);
app.use('/api/hotmart', hotmartRoutes);
app.use('/api/exclusion-logs', exclusionLogsRoutes);
app.use('/api/cart-abandonment', cartAbandonmentRoutes);



app.listen(PORT, () => {
    console.log(`🚀 CRM API running on http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (PostgreSQL)`);

    // Restaurar sessões do WhatsApp com delay (evita rate-limit no startup)
    console.log('⏰ Aguardando 10 segundos antes de restaurar sessões...');
    setTimeout(() => {
        console.log('🔄 Iniciando restauração de sessões WhatsApp...');
        restoreSessions();
    }, 10000); // 10 segundos de delay
});
