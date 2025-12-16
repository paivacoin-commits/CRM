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
import importsRoutes from './routes/imports.js';
import statusesRoutes from './routes/statuses.js';
import whatsappTemplatesRoutes from './routes/whatsappTemplates.js';

const PORT = process.env.PORT || 3001;

// Inicializar conexão com Supabase
initializeDatabase();

const app = express();

// CORS - aceita localhost e qualquer .vercel.app
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    /\.vercel\.app$/,  // Aceita qualquer subdomínio do vercel.app
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requests sem origin (como mobile apps ou curl)
        if (!origin) return callback(null, true);

        // Verifica se a origin é permitida
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) return allowed.test(origin);
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            callback(null, true); // Em produção, aceita tudo por enquanto
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', database: 'supabase' }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/imports', importsRoutes);
app.use('/api/statuses', statusesRoutes);
app.use('/api/whatsapp-templates', whatsappTemplatesRoutes);

app.listen(PORT, () => {
    console.log(`🚀 CRM API running on http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (PostgreSQL)`);
});
