/**
 * Users Routes - Supabase Version
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/users
 */
router.get('/', async (req, res) => {
    try {
        const users = await db.getUsers();

        // Buscar estatísticas de leads para cada usuário
        const usersWithStats = await Promise.all(users.map(async (u) => {
            const stats = await db.getUserLeadStats(u.id);
            return {
                id: u.id,
                uuid: u.uuid,
                name: u.name,
                email: u.email,
                role: u.role,
                is_active: u.is_active,
                is_in_distribution: u.is_in_distribution,
                created_at: u.created_at,
                total_leads: stats.total_leads || 0,
                conversions: stats.conversions || 0
            };
        }));

        res.json({ users: usersWithStats });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
});

/**
 * GET /api/users/sellers
 */
router.get('/sellers', async (req, res) => {
    try {
        const sellers = await db.getSellers();
        res.json({
            sellers: sellers.map(s => ({
                id: s.id,
                uuid: s.uuid,
                name: s.name,
                email: s.email,
                is_active: s.is_active,
                is_in_distribution: s.is_in_distribution
            }))
        });
    } catch (error) {
        console.error('Error fetching sellers:', error);
        res.status(500).json({ error: 'Erro ao buscar vendedoras' });
    }
});

/**
 * POST /api/users
 */
router.post('/', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        if (!['admin', 'seller'].includes(role)) {
            return res.status(400).json({ error: 'Role inválido' });
        }

        const existing = await db.getUserByEmail(email.toLowerCase());
        if (existing) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const user = await db.createUser({
            uuid: uuidv4(),
            name,
            email: email.toLowerCase(),
            password_hash,
            role,
            is_active: true,
            is_in_distribution: role === 'seller'
        });

        res.json({
            message: 'Usuário criado com sucesso',
            user: { uuid: user.uuid, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

/**
 * PATCH /api/users/:uuid
 */
router.patch('/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { name, email, password, is_active, is_in_distribution } = req.body;

        const user = await db.getUserByUuid(uuid);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (password) updateData.password_hash = await bcrypt.hash(password, 10);
        if (typeof is_active === 'boolean') updateData.is_active = is_active;
        if (typeof is_in_distribution === 'boolean') updateData.is_in_distribution = is_in_distribution;

        await db.updateUser(uuid, updateData);
        res.json({ message: 'Usuário atualizado com sucesso' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

/**
 * PATCH /api/users/:uuid/distribution
 */
router.patch('/:uuid/distribution', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { is_in_distribution } = req.body;

        await db.updateUser(uuid, { is_in_distribution });
        res.json({ message: 'Status de distribuição atualizado' });
    } catch (error) {
        console.error('Error updating distribution:', error);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

/**
 * DELETE /api/users/:uuid
 */
router.delete('/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;

        // Não permitir deletar a si mesmo
        if (uuid === req.user.uuid) {
            return res.status(400).json({ error: 'Você não pode deletar sua própria conta' });
        }

        await db.deleteUser(uuid);
        res.json({ message: 'Usuário deletado' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

export default router;
