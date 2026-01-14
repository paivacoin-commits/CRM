/**
 * Run migration: Create whatsapp_auth_state table
 * Executes SQL directly via Supabase client
 */

import { supabase } from './src/database/supabase.js';

async function runMigration() {
    try {
        console.log('🔄 Running migration: create_whatsapp_auth_state...');

        // Create table
        const { error: tableError } = await supabase.rpc('exec', {
            sql: `
                CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
                    connection_id TEXT PRIMARY KEY REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
                    creds JSONB NOT NULL DEFAULT '{}',
                    keys JSONB NOT NULL DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `
        });

        if (tableError && !tableError.message.includes('already exists')) {
            console.error('❌ Failed to create table:', tableError);
            // Try alternative method
            console.log('🔄 Trying alternative method...');

            // Just try to insert a test row to see if table exists
            const { error: testError } = await supabase
                .from('whatsapp_auth_state')
                .select('connection_id')
                .limit(1);

            if (testError) {
                console.error('❌ Table does not exist and cannot be created automatically.');
                console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
                console.log(`
CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    connection_id TEXT PRIMARY KEY REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
    creds JSONB NOT NULL DEFAULT '{}',
    keys JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_connection_id ON whatsapp_auth_state(connection_id);
                `);
                process.exit(1);
            }
        }

        console.log('✅ Migration completed successfully!');
        console.log('📊 Table whatsapp_auth_state is ready');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error running migration:', error);
        console.log('\n📋 Please run this SQL manually in Supabase SQL Editor:\n');
        console.log(`
CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    connection_id TEXT PRIMARY KEY REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
    creds JSONB NOT NULL DEFAULT '{}',
    keys JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_connection_id ON whatsapp_auth_state(connection_id);
        `);
        process.exit(1);
    }
}

runMigration();
