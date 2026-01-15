/**
 * ManyChat API Service
 * Handles integration with ManyChat API for cart abandonment recovery
 */

const MANYCHAT_API_BASE = 'https://api.manychat.com';

/**
 * Send webhook to ManyChat to add a TAG to a contact
 * This will trigger Flow 1 (first message)
 * 
 * @param {string} phone - Contact phone number
 * @param {string} tagName - Tag name to apply
 * @param {string} webhookUrl - ManyChat webhook URL
 * @returns {Promise<Object>} Response from ManyChat
 */
export async function sendTagWebhook(phone, tagName, webhookUrl) {
    try {
        console.log(`📤 Sending TAG webhook to ManyChat: phone=${phone}, tag=${tagName}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                phone: phone,
                tag: tagName,
                source: 'cart_abandonment'
            })
        });

        if (!response.ok) {
            throw new Error(`ManyChat webhook failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`✅ TAG webhook sent successfully`);
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error sending TAG webhook:', error);
        throw error;
    }
}

/**
 * Find subscriber by phone number
 * 
 * @param {string} phone - Contact phone number
 * @param {string} apiToken - ManyChat API token
 * @returns {Promise<string|null>} Subscriber ID or null if not found
 */
export async function findSubscriberByPhone(phone, apiToken) {
    try {
        console.log(`🔍 Finding ManyChat subscriber by phone: ${phone}`);

        const response = await fetch(`${MANYCHAT_API_BASE}/fb/subscriber/findBySystemField`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                field_name: 'phone',
                field_value: phone
            })
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log(`⚠️ Subscriber not found for phone: ${phone}`);
                return null;
            }
            throw new Error(`ManyChat API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const subscriberId = data?.data?.id;

        if (subscriberId) {
            console.log(`✅ Subscriber found: ${subscriberId}`);
            return subscriberId;
        }

        console.log(`⚠️ No subscriber ID in response`);
        return null;
    } catch (error) {
        console.error('❌ Error finding subscriber:', error);
        throw error;
    }
}

/**
 * Send flow to an existing subscriber
 * This triggers Flow 2 (second message)
 * 
 * @param {string} subscriberId - ManyChat subscriber ID
 * @param {string} flowId - Flow namespace ID
 * @param {string} apiToken - ManyChat API token
 * @returns {Promise<Object>} Response from ManyChat
 */
export async function sendFlowToSubscriber(subscriberId, flowId, apiToken) {
    try {
        console.log(`📤 Sending flow to subscriber: subscriberId=${subscriberId}, flowId=${flowId}`);

        const response = await fetch(`${MANYCHAT_API_BASE}/fb/sending/sendFlow`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subscriber_id: subscriberId,
                flow_ns: flowId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`ManyChat API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✅ Flow sent successfully to subscriber ${subscriberId}`);
        return { success: true, data };
    } catch (error) {
        console.error('❌ Error sending flow:', error);
        throw error;
    }
}

/**
 * Get list of available flows
 * Used for configuration UI
 * 
 * @param {string} apiToken - ManyChat API token
 * @returns {Promise<Array>} List of flows
 */
export async function getFlows(apiToken) {
    try {
        console.log(`📋 Fetching ManyChat flows`);

        const response = await fetch(`${MANYCHAT_API_BASE}/fb/page/getFlows`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`ManyChat API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const flows = data?.data || [];

        console.log(`✅ Found ${flows.length} flows`);
        return flows;
    } catch (error) {
        console.error('❌ Error fetching flows:', error);
        throw error;
    }
}

/**
 * Test ManyChat API connection
 * 
 * @param {string} apiToken - ManyChat API token
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function testConnection(apiToken) {
    try {
        console.log(`🧪 Testing ManyChat API connection`);

        const flows = await getFlows(apiToken);

        console.log(`✅ ManyChat API connection successful`);
        return true;
    } catch (error) {
        console.error('❌ ManyChat API connection failed:', error);
        return false;
    }
}
