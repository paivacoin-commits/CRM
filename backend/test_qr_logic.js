
import { initializeWhatsAppConnection, disconnectWhatsApp } from './src/services/whatsappService.js';
import { supabase } from './src/database/supabase.js';

async function testQR() {
    const TEST_CONN_ID = 'test-qr-connection-123';

    console.log('🧪 Starting QR Code Test...');

    // 1. Clean up
    console.log('🧹 Cleaning up old session...');
    await disconnectWhatsApp(TEST_CONN_ID);

    // Create dummy connection in DB if not exists
    const { error } = await supabase.from('whatsapp_connections').upsert({
        id: TEST_CONN_ID,
        name: 'Test QR Connection',
        status: 'disconnected'
    });

    if (error) console.error('Error creating test connection:', error);

    console.log('⏳ Initializing connection...');
    try {
        await initializeWhatsAppConnection(TEST_CONN_ID);
        console.log('✅ Initialization called. Waiting for QR logs...');
    } catch (e) {
        console.error('❌ Error during initialization:', e);
    }
}

testQR();
