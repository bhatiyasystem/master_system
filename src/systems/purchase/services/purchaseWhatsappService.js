import supabase from '../../../SupabaseClient';

/**
 * Purchase System — WhatsApp Service
 *
 * Uses a DEDICATED Meta WhatsApp Business webhook separate from the main system.
 * Credentials are read from VITE_PO_WHATSAPP_* environment variables.
 *
 * Template used:
 *   Name     : purchase_po
 *   Category : UTILITY
 *   Language : en
 *   Body     :
 *     "Dear {{1}},
 *      A new Purchase Order has been issued to you.
 *      PO Number: {{2}}
 *      PO Date:  {{3}}
 *      Please process the order as per the Purchase Order details.
 *      Thank you."
 */

// ─── API Configuration (uses the existing main WhatsApp credentials) ──────────
const API_URL         = import.meta.env.VITE_WHATSAPP_API_URL     || 'https://graph.facebook.com/v21.0';
const PHONE_NUMBER_ID = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN    = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;

// ─── Master toggle ────────────────────────────────────────────────────────────
const IS_ENABLED = true; // set to true to enable PO WhatsApp messages

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a phone number to E.164 format (digits only, with 91 prefix for Indian numbers).
 */
const formatPhone = (phone) => {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    return cleaned;
};

/**
 * Insert a record into the whatsapp_logs table.
 */
const insertLog = async ({
    recipientName,
    phone,
    messageType = 'Purchase Order',
    stage = 'PO Created',
    referenceId = '-',
    senderName = 'Purchase System',
    messageContent = '',
    status,
    errorMessage = null,
    errorCode = null,
    errorDetails = null,
    messageId = null,
    mediaUrl = null,
    mimeType = null,
    fileName = null,
}) => {
    try {
        const { error } = await supabase.from('whatsapp_logs').insert([{
            recipient_name  : recipientName || 'Vendor',
            phone_number    : phone,
            message_type    : messageType,
            stage,
            message_content : messageContent,
            status,
            error_message   : errorMessage,
            error_code      : errorCode,
            error_details   : errorDetails,
            sender_name     : senderName,
            reference_id    : referenceId,
            message_id      : messageId,
            media_url       : mediaUrl,
            mime_type       : mimeType,
            file_name       : fileName,
            direction       : 'outbound',
        }]);
        if (error) console.error('[PurchaseWA] Log insert failed:', error.message);
    } catch (e) {
        console.error('[PurchaseWA] Log insert exception:', e);
    }
};

// ─── Core template sender ─────────────────────────────────────────────────────

/**
 * Send a WhatsApp template message using the PURCHASE-SPECIFIC Meta webhook.
 *
 * @param {string}   phoneNumber    - Recipient phone (10-digit or with country code)
 * @param {string}   templateName  - Meta-approved template name
 * @param {string[]} parameters    - Ordered list of template variable values
 * @param {string}   languageCode  - Template language (default: 'en')
 * @param {object}   logMeta       - Extra metadata for whatsapp_logs
 */
const sendPurchaseTemplate = async (
    phoneNumber,
    templateName,
    parameters = [],
    languageCode = 'en',
    logMeta = {},
    documentUrl = null   // required if the template has a DOCUMENT header
) => {
    const formattedPhone = formatPhone(phoneNumber);
    const messageContent = `Template: ${templateName} | Params: ${parameters.join(' | ')}`;
    const finalLog = {
        recipientName  : logMeta.recipientName  || 'Vendor',
        phone          : formattedPhone,
        messageType    : logMeta.messageType    || (documentUrl ? 'Document' : templateName),
        stage          : logMeta.stage          || 'Notification',
        referenceId    : logMeta.referenceId    || '-',
        senderName     : logMeta.senderName     || 'Purchase System',
        messageContent : logMeta.messageContent || messageContent,
        mediaUrl       : documentUrl || logMeta.mediaUrl || null,
        mimeType       : documentUrl ? 'application/pdf' : (logMeta.mimeType || null),
        fileName       : documentUrl ? 'Purchase_Order.pdf' : (logMeta.fileName || null),
    };

    if (!formattedPhone) {
        console.error('[PurchaseWA] Invalid phone number:', phoneNumber);
        return false;
    }

    if (!IS_ENABLED) {
        console.log('[PurchaseWA] 🚫 WhatsApp messaging is DISABLED.');
        console.log(`  To: +${formattedPhone} | Template: ${templateName}`);
        return true;
    }

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        console.warn('[PurchaseWA] ⚠️  Credentials not configured (VITE_PO_WHATSAPP_*).');
        console.log(`  To: +${formattedPhone} | Template: ${templateName} | Params: ${JSON.stringify(parameters)}`);
        return true; // dev-mode pass-through
    }

    const url  = `${API_URL}/${PHONE_NUMBER_ID}/messages`;

    // Build components — always include body, add header if template requires a document
    const components = [];

    if (documentUrl) {
        components.push({
            type       : 'header',
            parameters : [{
                type     : 'document',
                document : {
                    link     : documentUrl,
                    filename : 'Purchase_Order.pdf',
                },
            }],
        });
    }

    components.push({
        type       : 'body',
        parameters : parameters.map((val) => ({
            type : 'text',
            text : String(val ?? 'N/A'),
        })),
    });

    const body = {
        messaging_product : 'whatsapp',
        recipient_type    : 'individual',
        to                : formattedPhone,
        type              : 'template',
        template          : {
            name      : templateName,
            language  : { code: languageCode },
            components,
        },
    };

    try {
        const response = await fetch(url, {
            method  : 'POST',
            headers : {
                Authorization  : `Bearer ${ACCESS_TOKEN}`,
                'Content-Type' : 'application/json',
            },
            body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok) {
            const apiErr = result.error || {};
            console.error(`[PurchaseWA] ❌ Template "${templateName}" failed — HTTP ${response.status}`);
            console.error('[PurchaseWA] Full Meta error response:', JSON.stringify(result, null, 2));
            console.error('[PurchaseWA] Error message:', apiErr.message);
            console.error('[PurchaseWA] Error code:', apiErr.code);
            console.error('[PurchaseWA] Error subcode:', apiErr.error_subcode);
            console.error('[PurchaseWA] Request body sent:', JSON.stringify(body, null, 2));
            await insertLog({
                ...finalLog,
                status       : 'Failed',
                errorMessage : apiErr.message || 'API Error',
                errorCode    : apiErr.code    || null,
                errorDetails : apiErr,
            });
            return false;
        }

        console.log(`[PurchaseWA] ✅ Template "${templateName}" sent to +${formattedPhone}:`, result);
        await insertLog({
            ...finalLog,
            status    : 'Sent',
            messageId : result.messages?.[0]?.id || null,
        });
        return true;
    } catch (err) {
        console.error(`[PurchaseWA] Exception sending "${templateName}":`, err);
        await insertLog({
            ...finalLog,
            status       : 'Failed',
            errorMessage : err.message || 'Unknown error',
            errorDetails : { stack: err.stack },
        });
        return false;
    }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a WhatsApp notification to the vendor when a new Purchase Order is created.
 *
 * Template  : purchase_po
 * Variables :
 *   {{1}} → vendorName   (vendor / contact name)
 *   {{2}} → poNo         (PO number, e.g. "PO-2026-001")
 *   {{3}} → poDate       (formatted date, e.g. "28 Jul 2026")
 *
 * @param {{ vendorName: string, poNo: string, poDate: string, documentUrl?: string, vendorContact?: string }} param0
 * @returns {Promise<boolean>}
 */
export const sendPOCreatedNotification = async ({ vendorName, poNo, poDate, documentUrl = null, vendorContact = null }) => {
    try {
        let recipientPhone = vendorContact ? String(vendorContact).trim() : null;

        // If contact is not provided directly in form, fetch from public.vendors table
        if (!recipientPhone && vendorName) {
            const { data, error } = await supabase
                .from('vendors')
                .select('contact')
                .ilike('name', vendorName.trim())
                .limit(1)
                .maybeSingle();

            if (!error && data && data.contact) {
                recipientPhone = String(data.contact).trim();
            } else if (error) {
                console.error('[PurchaseWA] Error fetching vendor contact from database:', error.message);
            }
        }

        if (!recipientPhone) {
            console.warn(`[PurchaseWA] ⚠️ No contact number found for vendor "${vendorName}". Cannot send WhatsApp notification.`);
            await insertLog({
                recipientName  : vendorName || 'Vendor',
                phone          : null,
                messageType    : 'Purchase Order',
                stage          : 'PO Created',
                referenceId    : poNo || '-',
                senderName     : 'Purchase Team',
                messageContent : `PO ${poNo} issued to ${vendorName} (No contact number available)`,
                status         : 'Failed',
                errorMessage   : `No contact number found for vendor "${vendorName}" in vendors table or form.`,
            });
            return false;
        }

        const formattedDate = poDate
            ? new Date(poDate).toLocaleDateString('en-IN', {
                day   : '2-digit',
                month : 'short',
                year  : 'numeric',
              })
            : 'N/A';

        // Parameters must match the template variable order exactly:
        //   {{1}} → vendorName  (vendor / contact name)
        //   {{2}} → poNo        (PO number, e.g. "BE/PO/2026-27/001")
        //   {{3}} → formattedDate (formatted date, e.g. "19 Aug 2026")
        const templateParams = [vendorName || 'Vendor', poNo || 'N/A', formattedDate];

        return await sendPurchaseTemplate(
            recipientPhone,
            'purchase_po',
            templateParams,
            'en',
            {
                recipientName  : vendorName || 'Vendor',
                messageType    : 'purchase_po',
                stage          : 'PO Created',
                referenceId    : poNo || '-',
                senderName     : 'Purchase Team',
                // Use structured format so WhatsApp History can parse {{1}}, {{2}}, {{3}} correctly
                messageContent : `Template: purchase_po | Params: ${templateParams.join(' | ')}`,
                fileName       : `PO_${(poNo || 'Order').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
                mimeType       : 'application/pdf',
                mediaUrl       : documentUrl,
            },
            documentUrl   // pass through — required by the purchase_po template header
        );
    } catch (err) {
        console.error('[PurchaseWA] sendPOCreatedNotification error:', err);
        return false;
    }
};
