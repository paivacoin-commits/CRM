/**
 * Schedules Routes - Sistema de Agendamentos
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/schedules - Lista agendamentos
 */
router.get('/', async (req, res) => {
    try {
        const { lead_id, upcoming_only } = req.query;
        const isAdmin = req.user.role === 'admin';

        const schedules = await db.getSchedules({
            lead_id: lead_id ? parseInt(lead_id) : null,
            seller_id: isAdmin ? null : req.user.id,
            upcoming_only: upcoming_only === 'true',
            limit: 100
        });

        res.json({ schedules });
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
});

/**
 * GET /api/schedules/lead/:leadId - Agendamentos de um lead específico
 */
router.get('/lead/:leadId', async (req, res) => {
    try {
        const schedules = await db.getSchedulesByLead(parseInt(req.params.leadId));
        res.json({ schedules });
    } catch (error) {
        console.error('Error fetching lead schedules:', error);
        res.status(500).json({ error: 'Erro ao buscar agendamentos do lead' });
    }
});

/**
 * POST /api/schedules - Criar agendamento
 */
router.post('/', async (req, res) => {
    try {
        const { lead_id, scheduled_at, observation } = req.body;

        console.log('📅 Criando agendamento:', { lead_id, scheduled_at, observation, user_id: req.user?.id });

        if (!lead_id || !scheduled_at) {
            return res.status(400).json({ error: 'Lead e data são obrigatórios' });
        }

        const schedule = await db.createSchedule({
            uuid: uuidv4(),
            lead_id,
            scheduled_at,
            observation: observation || null,
            completed: false,
            created_by: req.user.id
        });

        console.log('✅ Agendamento criado:', schedule);
        res.json({ message: 'Agendamento criado', schedule });
    } catch (error) {
        console.error('❌ Error creating schedule:', error.message, error);
        res.status(500).json({ error: 'Erro ao criar agendamento: ' + error.message });
    }
});

/**
 * PATCH /api/schedules/:uuid - Atualizar agendamento
 */
router.patch('/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { scheduled_at, observation, completed } = req.body;

        const updateData = {};
        if (scheduled_at !== undefined) updateData.scheduled_at = scheduled_at;
        if (observation !== undefined) updateData.observation = observation;
        if (typeof completed === 'boolean') updateData.completed = completed;

        await db.updateSchedule(uuid, updateData);
        res.json({ message: 'Agendamento atualizado' });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Erro ao atualizar agendamento' });
    }
});

/**
 * DELETE /api/schedules/:uuid - Deletar agendamento
 */
router.delete('/:uuid', async (req, res) => {
    try {
        await db.deleteSchedule(req.params.uuid);
        res.json({ message: 'Agendamento deletado' });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Erro ao deletar agendamento' });
    }
});

export default router;
