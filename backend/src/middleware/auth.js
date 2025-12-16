/**
 * Authentication Middleware - Supabase Version
 */

import jwt from 'jsonwebtoken';
import { db } from '../database/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-secret-key';

/**
 * Middleware de autenticação
 */
export function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}

/**
 * Middleware de autorização por role
 */
export function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Sem permissão para esta ação' });
        }

        next();
    };
}
