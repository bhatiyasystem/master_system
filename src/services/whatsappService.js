import supabase from "../SupabaseClient";

/**
 * WhatsApp Messaging Service
 * Sends task notifications to users via WhatsApp
 */


// Master toggle to enable/disable WhatsApp messaging
const IS_WHATSAPP_ENABLED = true; // Set to true to enable WhatsApp messages

// WhatsApp API Configuration (Meta Cloud API)
const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
const WHATSAPP_PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
const _WHATSAPP_WABA_ID = import.meta.env.VITE_WHATSAPP_WABA_ID;

const APP_LINK = "https://checklistdelegation.vercel.app/login";

/**
 * Check if WhatsApp service is enabled/connected
 * @returns {boolean}
 */
export const isWhatsAppConnected = () => IS_WHATSAPP_ENABLED;


/**
 * Format phone number to international format
 * @param {string} phone - Phone number (can be with or without country code)
 * @returns {string} - Formatted phone number with country code
 */
const formatPhoneNumber = (phone) => {
    if (!phone) return null;

    // Remove all non-digit characters
    let cleaned = String(phone).replace(/\D/g, '');

    // If doesn't start with country code, assume India (+91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }

    return cleaned;
};

/**
 * Get user phone number from database
 * @param {string} username - Username to fetch phone for
 * @returns {Promise<string|null>} - Phone number or null
 */
const getUserPhoneNumber = async (username) => {
    try {
        console.log(`🔍 Fetching phone for user: "${username}"`);
        const { data, error } = await supabase
            .from('users')
            .select('number')
            .eq('user_name', username)
            .limit(1);

        if (error) {
            console.error('Supabase User Fetch Error:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn(`⚠️ User "${username}" not found in database.`);
            return null;
        }

        return data[0]?.number || null;
    } catch (error) {
        console.error('Error fetching user phone:', error);
        return null;
    }
};

/**
 * Inserts a log into the whatsapp_logs table.
 */
const insertLog = async (logMeta, recipientPhone, status, errorMessage, messageId, messageContent, errorCode = null, errorDetails = null) => {
    try {
        const logEntry = {
            recipient_name: logMeta.recipientName || 'Unknown',
            phone_number: recipientPhone,
            message_type: logMeta.messageType || 'General',
            stage: logMeta.stage || 'General',
            message_content: messageContent || logMeta.messageContent || '-',
            status: status,
            error_message: errorMessage || null,
            error_code: errorCode || null,
            error_details: errorDetails || null,
            sender_name: logMeta.senderName || 'System',
            reference_id: logMeta.referenceId || '-',
            message_id: messageId || null,
            media_url: logMeta.mediaUrl || logMeta.media_url || null,
            mime_type: logMeta.mimeType || logMeta.mime_type || null,
            file_name: logMeta.fileName || logMeta.file_name || null,
            direction: 'outbound'
        };
        const { error } = await supabase.from('whatsapp_logs').insert([logEntry]);
        if (error) {
            console.error('WhatsApp Log Insertion Failed:', error.message);
        } else {
            console.log('WhatsApp Log Inserted Successfully');
        }
    } catch (e) {
        console.error('Error inserting WhatsApp log:', e);
    }
};

/**
 * Send WhatsApp message using Maytapi API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Message text
 * @param {Object} logMeta - Logging metadata
 * @returns {Promise<boolean>} - Success status
 */
const sendWhatsAppMessage = async (phoneNumber, message, logMeta = {}) => {
    const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
    const finalLogMeta = {
        recipientName: logMeta.recipientName || 'Admin',
        messageType: logMeta.messageType || 'Manual Text',
        stage: logMeta.stage || 'Support',
        referenceId: logMeta.referenceId || '-',
        senderName: logMeta.senderName || 'System',
        messageContent: message,
        ...logMeta
    };

    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (!formattedPhone) {
            console.error('Invalid phone number:', phoneNumber);
            return false;
        }

        // Master toggle check
        if (!IS_WHATSAPP_ENABLED) {
            console.log('🚫 WhatsApp Messaging is currently DISABLED');
            console.log(`Recipient: +${formattedPhone}`);
            console.log(`Message: ${message}`);
            return true; // Return true to avoid errors in calling components
        }

        // If API credentials are not configured, log to console instead
        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
            console.log('📱 WhatsApp Message (API not configured):');
            console.log(`To: +${formattedPhone}`);
            console.log(`Message: ${message}`);
            console.log('---');
            return true; // Return true for development
        }

        const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const body = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "text",
            text: {
                body: message
            }
        };

        console.log(`[Service] Meta Plain Text Request: URL: ${url}, Body:`, JSON.stringify(body, null, 2));
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        console.log(`[Service] Meta Plain Text Response: Status: ${response.status}, Result:`, JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error('Meta WhatsApp API Error:', response.status, response.statusText);
            console.error('Meta WhatsApp API Error Response:', JSON.stringify(result, null, 2));
            const apiErr = result.error || {};
            await insertLog(finalLogMeta, formattedPhone, 'Failed', apiErr.message || 'API Error', null, message, apiErr.code || null, apiErr);
            return false;
        }

        console.log('✅ WhatsApp message sent successfully via Meta:', result);
        await insertLog(finalLogMeta, formattedPhone, 'Sent', null, result.messages?.[0]?.id, message);
        return true;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        await insertLog(finalLogMeta, formattedPhone, 'Failed', error.message || 'Error', null, message, null, { stack: error.stack });
        return false;
    }
};

/**
 * Send WhatsApp message using Meta Template API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} templateName - Name of the template
 * @param {Array} parameters - Array of parameter values for the template
 * @param {string} languageCode - Language code (default: 'en')
 * @param {Object} logMeta - Logging metadata
 * @returns {Promise<boolean>} - Success status
 */
const sendWhatsAppTemplate = async (phoneNumber, templateName, parameters = [], languageCode = 'en', logMeta = {}) => {
    const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
    const finalLogMeta = {
        recipientName: logMeta.recipientName || 'Unknown',
        messageType: logMeta.messageType || templateName,
        stage: logMeta.stage || 'Notification',
        referenceId: logMeta.referenceId || '-',
        senderName: logMeta.senderName || 'System',
        messageContent: logMeta.messageContent || `Template: ${templateName} | Params: ${parameters.join(' | ')}`,
        ...logMeta
    };

    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);
        if (!formattedPhone) {
            console.error('Invalid phone number:', phoneNumber);
            return false;
        }

        // Master toggle check
        if (!IS_WHATSAPP_ENABLED) {
            console.log('🚫 WhatsApp Template Messaging is currently DISABLED');
            console.log(`Template: ${templateName}`);
            console.log(`To: +${formattedPhone}`);
            return true;
        }

        // If API credentials are not configured, log to console instead
        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
            console.log(`📱 WhatsApp Template Message (API not configured): ${templateName}`);
            console.log(`To: +${formattedPhone}`);
            console.log(`Params: ${JSON.stringify(parameters)}`);
            return true;
        }

        const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const { data: templateData } = await supabase
            .from('whatsapp_templates')
            .select('header_format, example_header_handle')
            .eq('name', templateName)
            .maybeSingle();

        const headerFormat = templateData?.header_format;
        const fallbackHeaderUrl = templateData?.example_header_handle;

        const components = [
            {
                type: "body",
                parameters: parameters.map(val => ({
                    type: "text",
                    text: String(val || 'N/A')
                }))
            }
        ];

        if (headerFormat === 'IMAGE') {
            let imageUrl = logMeta.mediaUrl || logMeta.media_url || fallbackHeaderUrl;
            if (!imageUrl || imageUrl.includes('scontent.whatsapp.net') || imageUrl.includes('fbcdn.net')) {
                imageUrl = "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800";
            }
            components.push({
                type: "header",
                parameters: [
                    {
                        type: "image",
                        image: {
                            link: imageUrl
                        }
                    }
                ]
            });
        } else if (headerFormat === 'DOCUMENT') {
            let docUrl = logMeta.mediaUrl || logMeta.media_url || fallbackHeaderUrl;
            if (!docUrl || docUrl.includes('scontent.whatsapp.net') || docUrl.includes('fbcdn.net')) {
                docUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
            }
            components.push({
                type: "header",
                parameters: [
                    {
                        type: "document",
                        document: {
                            link: docUrl,
                            filename: logMeta.fileName || logMeta.file_name || "Document.pdf"
                        }
                    }
                ]
            });
        }

        const body = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: languageCode
                },
                components: components
            }
        };

        console.log(`[Service] Meta Template Request: URL: ${url}, Body:`, JSON.stringify(body, null, 2));
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        console.log(`[Service] Meta Template Response: Status: ${response.status}, Result:`, JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.error(`Meta Template API Error (${templateName}):`, response.status, response.statusText);
            console.error('Response:', JSON.stringify(result, null, 2));
            const apiErr = result.error || {};
            await insertLog(finalLogMeta, formattedPhone, 'Failed', apiErr.message || 'API Error', null, finalLogMeta.messageContent, apiErr.code || null, apiErr);
            return false;
        }

        console.log(`✅ WhatsApp template "${templateName}" sent successfully:`, result);
        await insertLog(finalLogMeta, formattedPhone, 'Sent', null, result.messages?.[0]?.id, finalLogMeta.messageContent);
        return true;
    } catch (error) {
        console.error(`Error sending WhatsApp template "${templateName}":`, error);
        await insertLog(finalLogMeta, formattedPhone, 'Failed', error.message || 'Error', null, finalLogMeta.messageContent, null, { stack: error.stack });
        return false;
    }
};

/**
 * Send WhatsApp voice message (PTT/Audio) using Maytapi API
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} audioUrl - Public URL of the audio file
 * @param {Object} logMeta - Logging metadata
 * @returns {Promise<boolean>} - Success status
 */
const sendWhatsAppVoiceMessage = async (phoneNumber, audioUrl, logMeta = {}) => {
    const formattedPhone = formatPhoneNumber(phoneNumber) || phoneNumber;
    const finalLogMeta = {
        recipientName: logMeta.recipientName || 'User',
        messageType: logMeta.messageType || 'Voice Note',
        stage: logMeta.stage || 'Notification',
        referenceId: logMeta.referenceId || '-',
        senderName: logMeta.senderName || 'System',
        messageContent: `🎤 Voice Note: ${audioUrl}`,
        ...logMeta
    };

    try {
        const formattedPhone = formatPhoneNumber(phoneNumber);

        if (!formattedPhone) {
            console.error('Invalid phone number for voice message:', phoneNumber);
            return false;
        }

        // Master toggle check
        if (!IS_WHATSAPP_ENABLED) {
            console.log('🚫 WhatsApp Voice Messaging is currently DISABLED');
            console.log(`To: +${formattedPhone}`);
            return true;
        }

        // Development fallback
        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
            console.log('🎤 WhatsApp Voice Message (API not configured):');
            console.log(`To: +${formattedPhone}`);
            console.log(`Audio URL: ${audioUrl}`);
            return true;
        }

        const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: formattedPhone,
                type: "audio",
                audio: {
                    link: audioUrl
                }
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Meta WhatsApp Voice API Error:', response.status, response.statusText);
            console.error('Meta WhatsApp Voice API Error Response:', JSON.stringify(result, null, 2));
            const apiErr = result.error || {};
            await insertLog(finalLogMeta, formattedPhone, 'Failed', apiErr.message || 'API Error', null, finalLogMeta.messageContent, apiErr.code || null, apiErr);
            return false;
        }

        console.log('✅ WhatsApp voice message sent successfully via Meta:', result);
        await insertLog(finalLogMeta, formattedPhone, 'Sent', null, result.messages?.[0]?.id, finalLogMeta.messageContent);
        return true;
    } catch (error) {
        console.error('Error sending WhatsApp voice message:', error);
        await insertLog(finalLogMeta, formattedPhone, 'Failed', error.message || 'Error', null, finalLogMeta.messageContent, null, { stack: error.stack });
        return false;
    }
};

/**
 * Sends a plain text message (non-template)
 * Note: Only works if the user has messaged in the last 24 hours.
 */
export const sendWhatsAppTextMessage = async (phoneNumber, text, logMeta = {}) => {
    return sendWhatsAppMessage(phoneNumber, text, logMeta);
};

export const sendWhatsAppTemplateMessage = async (phoneNumber, templateName, parameters = [], languageCode = 'en', logMeta = {}) => {
    return sendWhatsAppTemplate(phoneNumber, templateName, parameters, languageCode, logMeta);
};

export const whatsappLogService = {
    async fetchLogs() {
        const { data, error } = await supabase
            .from('whatsapp_logs_with_templates')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    subscribeToChanges(callback) {
        const channel = supabase
            .channel('whatsapp_logs_changes')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'whatsapp_logs' },
                (payload) => callback('INSERT', payload.new)
            )
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'whatsapp_logs' },
                (payload) => callback('UPDATE', payload.new)
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    },

    async markAsRead(ids) {
        const { error } = await supabase
            .from('whatsapp_logs')
            .update({ is_read: true })
            .in('id', ids);
        if (error) throw error;
        return true;
    },

    async markMessagesAsRead(contactId) {
        const { error } = await supabase
            .from('whatsapp_logs')
            .update({ is_read: true })
            .eq('is_read', false)
            .or(`phone_number.eq.${contactId},recipient_name.eq.${contactId}`);
        if (error) throw error;
        return true;
    },

    async syncTemplates() {
        const WHATSAPP_ACCESS_TOKEN = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
        const WHATSAPP_WABA_ID = import.meta.env.VITE_WHATSAPP_WABA_ID;
        const WHATSAPP_API_URL = import.meta.env.VITE_WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';
        
        if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_WABA_ID) {
            throw new Error("WhatsApp API credentials are not configured in environment variables.");
        }

        const url = `${WHATSAPP_API_URL}/${WHATSAPP_WABA_ID}/message_templates?limit=100`;
        const res = await fetch(url, {
            headers: { "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
        });

        if (!res.ok) {
            throw new Error(`Meta API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const templatesList = data.data || [];

        const upserts = templatesList.map((t) => {
            const bodyComp = t.components?.find((c) => c.type === "BODY");
            const headerComp = t.components?.find((c) => c.type === "HEADER");
            const footerComp = t.components?.find((c) => c.type === "FOOTER");
            const buttonsComp = t.components?.find((c) => c.type === "BUTTONS");

            const bodyText = bodyComp?.text || "No body text";
            const bodyVarMatches = bodyText.match(/{{\d+}}/g) || [];
            const bodyVariableCount = bodyVarMatches.length
                ? Math.max(...bodyVarMatches.map((m) => parseInt(m.replace(/\D/g, ''), 10)))
                : 0;
            const headerFormat = headerComp?.format || 'NONE';

            return {
                name: t.name,
                status: t.status,
                language: t.language || "en",
                body_text: bodyText,
                header_text: headerFormat === 'TEXT' ? (headerComp?.text || null) : null,
                footer_text: footerComp?.text || null,
                buttons: buttonsComp?.buttons || null,
                header_format: headerFormat,
                body_variable_count: bodyVariableCount,
                header_variable_present: headerFormat === 'TEXT' && /{{\d+}}/.test(headerComp?.text || ''),
                example_body_params: bodyComp?.example?.body_text?.[0] || null,
                example_header_handle: headerComp?.example?.header_handle?.[0] || null,
                updated_at: new Date().toISOString()
            };
        });

        if (upserts.length > 0) {
            const { error } = await supabase
                .from("whatsapp_templates")
                .upsert(upserts, { onConflict: "name" });
            if (error) throw error;
        }

        return upserts.length;
    },
};

/**
 * Send urgent task notification
 */
export const sendUrgentTaskNotification = async (taskDetails) => {
    try {
        const {
            doerName,
            taskId,
            description,
            dueDate,
            givenBy,
            _taskType,
            _machineName,
            _partName,
            _department
        } = taskDetails;

        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: urgent_task_assigned
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} description, {{4}} startDate, {{5}} givenBy, {{6}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'urgent_task_assigned',
            [doerName, taskId, displayDescription, dueDate, givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending urgent notification:', error);
        return false;
    }
};

/**
 * Send checklist task notification
 */
export const sendChecklistTaskNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, startDate, givenBy, department, duration } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: checklist_task_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} department, {{4}} description, {{5}} startDate, {{6}} duration, {{7}} givenBy, {{8}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'checklist_task_notification',
            [doerName, taskId, department || 'N/A', displayDescription, startDate, duration || 'N/A', givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending checklist notification:', error);
        return false;
    }
};

/**
 * Send maintenance task notification
 */
export const sendMaintenanceTaskNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, startDate, givenBy, machineName, partName, department, duration } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: maintenance_task_assigned
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} machineName, {{4}} partName, {{5}} department, {{6}} description, {{7}} startDate, {{8}} duration, {{9}} givenBy, {{10}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'maintenance_task_assigned',
            [doerName, taskId, machineName || 'N/A', partName || 'N/A', department || 'N/A', displayDescription, startDate, duration || 'N/A', givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending maintenance notification:', error);
        return false;
    }
};

/**
 * Send repair task notification
 */
export const sendRepairTaskNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, startDate, givenBy, machineName, department, duration } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: repair_task_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} machineName, {{4}} department, {{5}} description, {{6}} startDate, {{7}} duration, {{8}} givenBy, {{9}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'repair_task_notification',
            [doerName, taskId, machineName || 'N/A', department || 'N/A', displayDescription, startDate, duration || 'N/A', givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending repair notification:', error);
        return false;
    }
};

/**
 * Send EA task notification
 */
export const sendEATaskNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, startDate, givenBy, duration } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: ea_task_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} description, {{4}} startDate, {{5}} duration, {{6}} givenBy, {{7}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'ea_task_notification',
            [doerName, taskId, displayDescription, startDate, duration || 'N/A', givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending EA notification:', error);
        return false;
    }
};

/**
 * Send delegation task notification
 */
export const sendDelegationTaskNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, startDate, givenBy, department, _duration } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: new_task_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} department, {{4}} description, {{5}} startDate, {{6}} givenBy, {{7}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'new_task_notification',
            [doerName, taskId, department || 'N/A', displayDescription, startDate, givenBy, APP_LINK],
            'en_US', // User specified en_US for this template
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending delegation notification:', error);
        return false;
    }
};

/**
 * Send task extension notification
 */
export const sendTaskExtensionNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, givenBy, description, nextExtendDate } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);

        if (!phoneNumber) return false;

        // Extract audio URL from description if present
        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);

        // If description is JUST the URL, enhance it
        const displayDescription = (audioUrl && description?.trim() === audioUrl)
            ? `🎤 Voice Note: ${audioUrl}`
            : description;

        // Template: task_extend_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} description, {{4}} nextExtendDate, {{5}} givenBy, {{6}} link
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'task_extend_notification',
            [doerName, taskId, displayDescription, nextExtendDate, givenBy, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }

        return sent;
    } catch (error) {
        console.error('Error sending extension notification:', error);
        return false;
    }
};

/**
 * Send task assignment notification (Delegation Task)
 */
export const sendTaskAssignmentNotification = async (taskDetails) => {
    const { taskType } = taskDetails;

    switch (taskType?.toLowerCase()) {
        case 'checklist':
            return sendChecklistTaskNotification(taskDetails);
        case 'maintenance':
            return sendMaintenanceTaskNotification(taskDetails);
        case 'repair':
            return sendRepairTaskNotification(taskDetails);
        case 'ea':
            return sendEATaskNotification(taskDetails);
        case 'delegation':
            return sendDelegationTaskNotification(taskDetails);
        default:
            // For backward compatibility or if type is not provided
            try {
                const {
                    doerName,
                    taskId,
                    givenBy,
                    description,
                    startDate,
                } = taskDetails;

                const phoneNumber = await getUserPhoneNumber(doerName);

                if (!phoneNumber) {
                    console.warn(`No phone number found for user: ${doerName}`);
                    return false;
                }

                const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
                const match = description && description.match(urlRegex);
                const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
                const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note Link: ${audioUrl}` : description;

                const message = `🔔 *REMINDER: DELEGATION TASK*\n` +
                    `Dear ${doerName},\n\n` +
                    `You have been assigned a new task. Please find the details below:\n\n` +
                    `📌 Task ID: ${taskId}\n` +
                    `🧑 Allocated By: ${givenBy}\n` +
                    `📝 Task Description: ${displayDescription}\n\n\n` +
                    `⏳ Deadline: ${startDate}\n` +
                    `✅ Closure Link: https://checklist-delegation-supabase-five.vercel.app/login\n` +
                    `Please make sure the task is completed before the deadline. For any assistance, feel free to reach out.\n\n` +
                    `Best regards,\n` +
                    `Acemark Stationers.`;

                const sent = await sendWhatsAppMessage(phoneNumber, message);
                if (sent && audioUrl) {
                    await new Promise(r => setTimeout(r, 1000));
                    await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
                }
                return sent;
            } catch (error) {
                console.error('Error sending task assignment notification:', error);
                return false;
            }
    }
};

/**
 * DEPRECATED - use sendTaskAssignmentNotification
 */
const _formatTaskMessage = (_taskDetails) => {
    return "Please use specific notification functions";
};

/**
 * Send task reminder notification
 * @param {Object} taskDetails - Task details
 * @returns {Promise<boolean>} - Success status
 */
export const sendTaskReminderNotification = async (taskDetails) => {
    try {
        const { doerName, description, dueDate } = taskDetails;

        const phoneNumber = await getUserPhoneNumber(doerName);

        if (!phoneNumber) {
            console.warn(`No phone number found for user: ${doerName}`);
            return false;
        }

        // Template: pending_task_reminder
        // Variables: {{1}} doerName, {{2}} description, {{3}} dueDate, {{4}} link
        return await sendWhatsAppTemplate(
            phoneNumber,
            'pending_task_reminder',
            [doerName, description, dueDate, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: '-', senderName: 'System' }
        );
    } catch (error) {
        console.error('Error sending task reminder:', error);
        return false;
    }
};

/**
 * Send task completion notification to admin
 * @param {Object} taskDetails - Task details
 * @returns {Promise<boolean>} - Success status
 */
export const sendTaskCompletionNotification = async (taskDetails) => {
    try {
        const { givenBy, doerName, description, completedAt } = taskDetails;

        const phoneNumber = await getUserPhoneNumber(givenBy);

        if (!phoneNumber) {
            console.warn(`No phone number found for admin: ${givenBy}`);
            return false;
        }

        // Template: task_completed_notification
        // Variables: {{1}} description, {{2}} completedAt, {{3}} doerName
        return await sendWhatsAppTemplate(
            phoneNumber,
            'task_completed_notification',
            [description, completedAt, doerName],
            'en',
            { recipientName: givenBy, referenceId: '-', senderName: doerName }
        );
    } catch (error) {
        console.error('Error sending completion notification:', error);
        return false;
    }
};



/**
 * Send task rejection notification
 */
export const sendTaskRejectionNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, _taskType, reason } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);

        if (!phoneNumber) {
            console.warn(`No phone number found for user: ${doerName}`);
            return false;
        }

        // Template: task_rejected_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} description, {{4}} reason, {{5}} link
        return await sendWhatsAppTemplate(
            phoneNumber,
            'task_rejected_notification',
            [doerName, taskId, description || 'N/A', reason || 'No reason provided', APP_LINK],
            'en',
            { recipientName: doerName, referenceId: taskId, senderName: 'Admin' }
        );
    } catch (error) {
        console.error('Error sending rejection notification:', error);
        return false;
    }
};

/**
 * Send task reassignment notification (Shifted Task)
 */
export const sendTaskReassignmentNotification = async (taskDetails) => {
    try {
        const {
            newDoerName,
            originalDoerName,
            taskId,
            description,
            startDate,
            givenBy,
            department,
            taskType
        } = taskDetails;

        const phoneNumber = await getUserPhoneNumber(newDoerName);
        if (!phoneNumber) return false;

        const urlRegex = /(https?:\/\/[^\s]+(?:voice-notes|audio-recordings)[^\s]*\.(?:mp3|ogg|wav|webm|m4a)?)/i;
        const match = description && description.match(urlRegex);
        const audioUrl = taskDetails.audioUrl || (match ? match[0] : null);
        const displayDescription = (audioUrl && description?.trim() === audioUrl) ? `🎤 Voice Note: ${audioUrl}` : description;

        // Template: task_transfer_notification
        // Variables: {{1}} doerName, {{2}} taskId, {{3}} taskType, {{4}} department, {{5}} description, {{6}} startDate, {{7}} link, {{8}} originalDoerName
        const sent = await sendWhatsAppTemplate(
            phoneNumber,
            'task_transfer_notification',
            [newDoerName, taskId, taskType || 'TASK', department || 'N/A', displayDescription, startDate, APP_LINK, originalDoerName],
            'en',
            { recipientName: newDoerName, referenceId: taskId, senderName: givenBy }
        );

        if (sent && audioUrl) {
            await new Promise(r => setTimeout(r, 1000));
            await sendWhatsAppVoiceMessage(phoneNumber, audioUrl);
        }
        return sent;
    } catch (error) {
        console.error('Error sending reassignment notification:', error);
        return false;
    }
};

/**
 * Send Password Reset OTP to Admin
 */
export const sendPasswordResetOTP = async (username, otp) => {
    try {
        const adminNumber = "9028105766";
        const message = `🔐 *PASSWORD RESET REQUEST*\n\n` +
            `A password reset has been requested for:\n` +
            `👤 User: *${username}*\n` +
            `🔢 OTP Code: *${otp}*\n\n` +
            `Please provide this code to the user if the request is valid.\n\n` +
            `Acemark Stationers_`;

        return await sendWhatsAppMessage(adminNumber, message);
    } catch (error) {
        console.error('Error sending password reset OTP:', error);
        return false;
    }
};

/**
 * Send admin remark notification for task extension
 */
export const sendAdminExtensionRemarkNotification = async (taskDetails) => {
    try {
        const { doerName, taskId, description, remark } = taskDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);

        if (!phoneNumber) return false;

        const message = `📝 *ADMIN REMARK ON EXTENSION*\n` +
            `Dear ${doerName},\n\n` +
            `Admin has added a remark regarding your task extension request.\n\n` +
            `📌 Task ID: ${taskId}\n` +
            `📋 Task: ${description || 'N/A'}\n` +
            `💬 Remark: *${remark}*\n\n` +
            `🔗 App Link: https://checklist-delegation-supabase-five.vercel.app/login\n\n` +
            `Best regards,\nAcemark Stationers.`;

        return await sendWhatsAppMessage(phoneNumber, message);
    } catch (error) {
        console.error('Error sending extension remark notification:', error);
        return false;
    }
};

/**
 * Send daily task summary notification
 * @param {Object} summaryDetails - Summary details
 * @returns {Promise<boolean>} - Success status
 */
export const sendDailyTaskSummaryNotification = async (summaryDetails) => {
    try {
        const { doerName, totalTasks, pendingTasks, todayTasks } = summaryDetails;
        const phoneNumber = await getUserPhoneNumber(doerName);
        if (!phoneNumber) return false;

        // Template: daily_task_notification
        // Variables: {{1}} doerName, {{2}} totalTasks, {{3}} pendingTasks, {{4}} todayTasks, {{5}} link
        return await sendWhatsAppTemplate(
            phoneNumber,
            'daily_task_notification',
            [doerName, totalTasks, pendingTasks, todayTasks, APP_LINK],
            'en',
            { recipientName: doerName, referenceId: '-', senderName: 'System' }
        );
    } catch (error) {
        console.error('Error sending daily task summary:', error);
        return false;
    }
};

/**
 * Send purchase delivered notification
 * @param {Object} deliveryDetails - Delivery details
 * @returns {Promise<boolean>} - Success status
 */
export const sendPurchaseDeliveredNotification = async (deliveryDetails) => {
    try {
        const { recipientName, transporterName, lrNo, date, productName, size1, size2 } = deliveryDetails;
        const phoneNumber = await getUserPhoneNumber(recipientName);
        if (!phoneNumber) return false;

        // Template: purchase_delivered
        // Variables: {{1}} TransporterName, {{2}} LRNo, {{3}} Date, {{4}} ProductName, {{5}} Size1, {{6}} Size2
        return await sendWhatsAppTemplate(
            phoneNumber,
            'purchase_delivered',
            [transporterName, lrNo, date, productName, size1, size2],
            'en',
            { recipientName: recipientName, referenceId: lrNo, senderName: 'System' }
        );
    } catch (error) {
        console.error('Error sending purchase delivered notification:', error);
        return false;
    }
};

export default {
    sendUrgentTaskNotification,
    sendTaskExtensionNotification,
    sendTaskAssignmentNotification,
    sendChecklistTaskNotification,
    sendMaintenanceTaskNotification,
    sendRepairTaskNotification,
    sendEATaskNotification,
    sendDelegationTaskNotification,
    sendTaskReminderNotification,
    sendTaskCompletionNotification,
    sendTaskRejectionNotification,
    sendTaskReassignmentNotification,
    sendPasswordResetOTP,
    sendAdminExtensionRemarkNotification,
    sendDailyTaskSummaryNotification,
    sendPurchaseDeliveredNotification,
    sendWhatsAppTextMessage,
    sendWhatsAppTemplateMessage,
    whatsappLogService
};
