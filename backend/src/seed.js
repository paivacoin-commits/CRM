/**
 * Seed Script - Cria dados iniciais para teste
 */
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db, { initializeDatabase } from './database/db.js';

initializeDatabase();

// Criar admin
const adminHash = bcrypt.hashSync('admin123', 10);
db.prepare(`INSERT OR IGNORE INTO users (uuid, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`).run(uuidv4(), 'Administrador', 'admin@crm.com', adminHash, 'admin');

// Criar vendedoras
const sellerHash = bcrypt.hashSync('senha123', 10);
const sellers = ['Ana Silva', 'Beatriz Santos', 'Carla Oliveira'];
sellers.forEach(name => {
    const email = name.toLowerCase().replace(' ', '.') + '@crm.com';
    db.prepare(`INSERT OR IGNORE INTO users (uuid, name, email, password_hash, role, is_in_distribution) VALUES (?, ?, ?, ?, ?, ?)`).run(uuidv4(), name, email, sellerHash, 'seller', 1);
});

console.log('✅ Seed completed!');
console.log('Admin: admin@crm.com / admin123');
console.log('Sellers: ana.silva@crm.com, beatriz.santos@crm.com, carla.oliveira@crm.com / senha123');
