# WhatsApp Setup Guide for `master_system`

This document details how to set up the necessary database table and the Meta WhatsApp API Webhook in Supabase to enable real-time messaging audit logs.

---

## 1. Database Table Creation

Please run the following SQL script in your **Supabase SQL Editor** to create the `whatsapp_logs` table:

```sql
-- 1. Create the whatsapp_logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  recipient_name text,
  phone_number text,
  message_type text,
  message_content text,
  status text,
  error_message text,
  sender_name text,
  reference_id text,
  stage text,
  is_read boolean DEFAULT true,
  message_id text,
  media_url text,
  mime_type text,
  file_name text,
  direction text DEFAULT 'outbound',
  CONSTRAINT whatsapp_logs_pkey PRIMARY KEY (id)
);

-- 1b. Migration for existing whatsapp_logs table (Run if table already exists)
ALTER TABLE public.whatsapp_logs 
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS direction text DEFAULT 'outbound';

-- 1c. Storage Bucket for WhatsApp Documents & Media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-documents', 'whatsapp-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Add an index for performance when auditing/sorting by contact or message ID
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone_recipient ON public.whatsapp_logs (phone_number, recipient_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_message_id ON public.whatsapp_logs (message_id);

-- 3. Enable RLS and create policies (Optional, or adjust for your security rules)
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users" 
ON public.whatsapp_logs 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow insert for authenticated users" 
ON public.whatsapp_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" 
ON public.whatsapp_logs 
FOR UPDATE 
TO authenticated 
USING (true);
```

---

## 2. Deploy Webhook Edge Function

To process incoming WhatsApp replies and status updates (delivered, read, failed) from Meta, deploy a Supabase Edge Function:

### Step 2.1: Define Webhook Code
Create a new function named `whatsapp-webhook` in your Supabase directory (or locally if using the Supabase CLI) with this logic:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

// Download media from Meta Cloud API and upload to Supabase Storage bucket (whatsapp-documents)
async function processAndSaveMedia(mediaId: string, defaultFilename: string, mimeType: string) {
  if (!WHATSAPP_ACCESS_TOKEN) return { mediaUrl: null, fileName: defaultFilename };

  try {
    // 1. Fetch temporary Media Download URL from Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
    });
    if (!metaRes.ok) return { mediaUrl: null, fileName: defaultFilename };
    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;

    // 2. Fetch binary stream from Meta
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` }
    });
    if (!fileRes.ok) return { mediaUrl: null, fileName: defaultFilename };
    const fileBlob = await fileRes.blob();

    // 3. Upload to Supabase Storage (whatsapp-documents bucket)
    const fileExt = defaultFilename.includes(".") ? defaultFilename.split(".").pop() : "bin";
    const storagePath = `incoming/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadErr } = await supabase.storage
      .from("whatsapp-documents")
      .upload(storagePath, fileBlob, { contentType: mimeType || "application/octet-stream" });

    if (uploadErr) {
      console.error("Storage Upload Error:", uploadErr);
      return { mediaUrl: null, fileName: defaultFilename };
    }

    // 4. Get Public URL
    const { data: publicUrlData } = supabase.storage
      .from("whatsapp-documents")
      .getPublicUrl(storagePath);

    return { mediaUrl: publicUrlData.publicUrl, fileName: defaultFilename };
  } catch (err) {
    console.error("Error processing incoming attachment:", err);
    return { mediaUrl: null, fileName: defaultFilename };
  }
}

serve(async (req) => {
  const { method } = req

  // 1. Meta Webhook Verification (GET)
  if (method === "GET") {
    const url = new URL(req.url)
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED")
      return new Response(challenge, { status: 200 })
    }
    return new Response("Forbidden", { status: 403 })
  }

  // 2. Incoming messages/status updates (POST)
  if (method === "POST") {
    try {
      const body = await req.json()

      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0]
        const changes = entry?.changes?.[0]
        const value = changes?.value

        // A. Handle Status Updates (sent, delivered, read, failed)
        if (value?.statuses?.[0]) {
          const statusObj = value.statuses[0]
          const messageId = statusObj.id
          const status = statusObj.status // e.g. "delivered", "read"
          
          console.log(`Status update for ${messageId}: ${status}`)

          const { error } = await supabase
            .from("whatsapp_logs")
            .update({ status: status.charAt(0).toUpperCase() + status.slice(1) })
            .eq("message_id", messageId)

          if (error) console.error("Status Update Error:", error)
          return new Response("STATUS_UPDATED", { status: 200 })
        }

        // B. Handle Incoming Messages (Customer Reply including Documents & Media)
        const message = value?.messages?.[0]
        const contact = value?.contacts?.[0]

        if (message) {
          const from = message.from // Sender's phone number
          const senderName = contact?.profile?.name || "WhatsApp User"
          let textContent = ""
          let messageType = "Incoming"
          let mediaUrl: string | null = null
          let mimeType: string | null = null
          let fileName: string | null = null

          if (message.type === "text") {
            textContent = message.text.body
          } else if (message.type === "document") {
            messageType = "Document"
            const doc = message.document
            fileName = doc.filename || "incoming_document.pdf"
            mimeType = doc.mime_type || "application/pdf"
            const caption = doc.caption || ""
            
            const mediaResult = await processAndSaveMedia(doc.id, fileName, mimeType)
            mediaUrl = mediaResult.mediaUrl
            textContent = caption ? `${caption}\n[Document]: ${fileName}` : `[Document]: ${fileName}`
          } else if (message.type === "image") {
            messageType = "Image"
            const img = message.image
            fileName = "incoming_image.jpg"
            mimeType = img.mime_type || "image/jpeg"
            const caption = img.caption || ""
            
            const mediaResult = await processAndSaveMedia(img.id, fileName, mimeType)
            mediaUrl = mediaResult.mediaUrl
            textContent = caption || `[Media File]: ${fileName}`
          } else if (message.type === "audio") {
            messageType = "Voice Note"
            const audio = message.audio
            fileName = "voice_note.mp3"
            mimeType = audio.mime_type || "audio/mp3"
            
            const mediaResult = await processAndSaveMedia(audio.id, fileName, mimeType)
            mediaUrl = mediaResult.mediaUrl
            textContent = `🎤 Voice Note: ${fileName}`
          } else if (message.type === "button") {
            textContent = message.button.text
          } else if (message.type === "interactive") {
            const interactiveType = message.interactive.type
            if (interactiveType === "button_reply") {
              textContent = message.interactive.button_reply.title
            } else if (interactiveType === "list_reply") {
              textContent = message.interactive.list_reply.title
            }
          } else {
            textContent = `[Received ${message.type} message]`
          }

          console.log(`Saving message from ${from}: ${textContent}`)

          const { error } = await supabase.from("whatsapp_logs").insert([
            {
              phone_number: from,
              recipient_name: senderName,
              message_content: textContent,
              status: "Received",
              message_type: messageType,
              stage: "Customer Reply",
              sender_name: senderName,
              is_read: false,
              message_id: message.id,
              media_url: mediaUrl,
              mime_type: mimeType,
              file_name: fileName,
              direction: "inbound"
            },
          ])

          if (error) {
            console.error("Database Insert Error:", error)
            return new Response("Error saving to DB", { status: 500 })
          }

          return new Response("EVENT_RECEIVED", { status: 200 })
        }
      }
      return new Response("Not a message", { status: 200 })
    } catch (err) {
      console.error("Webhook Processing Error:", err)
      return new Response("Internal Server Error", { status: 500 })
    }
  }

  return new Response("Method Not Allowed", { status: 405 })
})
```

### Step 2.2: Set Webhook Environment Secrets
Ensure the following Secrets are set in your **Supabase Dashboard** -> **Project Settings** -> **Edge Functions**:
- `WHATSAPP_VERIFY_TOKEN`: A custom secret string (e.g. `your_custom_verification_token`) to verify WhatsApp configuration.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (usually set automatically by Supabase).

---

## 3. Meta App Configuration

1. In the **Meta for Developers Console**, go to your App -> **WhatsApp** -> **Configuration**.
2. Click **Edit** in the Webhook section:
   - **Callback URL**: Enter the public URL of your deployed Supabase edge function:
     `https://<your-project-ref>.supabase.co/functions/v1/whatsapp-webhook`
   - **Verify Token**: Enter the same token value you configured in `WHATSAPP_VERIFY_TOKEN`.
3. Save and then **Subscribe** to the `messages` webhook field.
