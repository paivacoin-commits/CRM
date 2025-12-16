/**
 * Authentication Routes - Supabase Version
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/supabase.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'crm-secret-key';

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log('🔐 Login attempt:', email);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const user = await db.getUserByEmail(email.toLowerCase());
        console.log('👤 User found:', user ? 'YES' : 'NO');

        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        console.log('📧 User data:', JSON.stringify(user, null, 2));

        // Tratar is_active como true se for null/undefined
        const isActive = user.is_active !== false;
        console.log('✅ Is active (treated):', isActive);

        if (!isActive) {
            return res.status(401).json({ error: 'Usuário inativo' });
        }

        console.log('🔒 Comparing passwords...');
        console.log('🔒 Password received:', password);
        console.log('🔒 Password hash:', user.password_hash);
        console.log('🔒 Password hash length:', user.password_hash?.length);

        try {
            const validPassword = await bcrypt.compare(password, user.password_hash);
            console.log('🔑 Password valid:', validPassword);

            if (!validPassword) {
                return res.status(401).json({ error: 'Credenciais inválidas' });
            }
        } catch (bcryptError) {
            console.error('❌ Bcrypt error:', bcryptError);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, uuid: user.uuid, email: user.email, role: user.role, name: user.name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('✅ Login successful!');
        res.json({
            token,
            user: { uuid: user.uuid, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await db.getUserById(decoded.id);
        if (!user || !user.is_active) {
            return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
        }

        res.json({
            user: { uuid: user.uuid, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
});

export default router;
