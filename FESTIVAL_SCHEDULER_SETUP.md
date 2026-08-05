# Festival WhatsApp Scheduler Setup Guide

This document details how to set up the database schema, storage bucket, Edge Function, and cron job in Supabase to enable the Festival WhatsApp Message Scheduler (`src/systems/greetings/src/pages/FestivalSchedulerAdmin.jsx`).

Follow the same manual process used for `whatsapp_logs` in `WHATSAPP_SETUP.md` — there is no migrations CLI wired up in this repo, so run each SQL block below in the **Supabase SQL Editor**.

---

## 1. Database Schema

```sql
-- ════════════════════════════════════════════════════════════════════════
-- 1. festival_contacts — persistent audience table
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.festival_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  phone_number text NOT NULL,
  email text,
  extra_fields jsonb DEFAULT '{}'::jsonb,   -- any additional CSV columns (city, tier, business_name, etc.)
  is_active boolean DEFAULT true,
  CONSTRAINT festival_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT festival_contacts_phone_unique UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS idx_festival_contacts_active ON public.festival_contacts (is_active);

ALTER TABLE public.festival_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for authenticated users" ON public.festival_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.festival_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.festival_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated users" ON public.festival_contacts FOR DELETE TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- 2. festival_schedules — one row per "Create Schedule" submission
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.festival_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.users(id),
  occasion text NOT NULL,
  template_name text NOT NULL REFERENCES public.whatsapp_templates(name),
  schedule_at timestamp with time zone NOT NULL,  -- the actual instant the cron tick checks against
  audience_type text NOT NULL CHECK (audience_type IN ('all', 'selected', 'csv')),
  status text NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Scheduled', 'Running', 'Paused', 'Completed', 'Cancelled', 'Failed')),
  variable_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  /*
    {
      "1": {"type":"field","value":"name"},
      "2": {"type":"custom","value":"Happy Diwali"},
      "header_media": "https://<project>.supabase.co/storage/v1/object/public/festival-media/festival/banner.jpg"
    }
  */
  total_recipients integer DEFAULT 0,
  completed_recipients integer DEFAULT 0,
  failed_recipients integer DEFAULT 0,
  last_run_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  CONSTRAINT festival_schedules_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_festival_schedules_status ON public.festival_schedules (status);
CREATE INDEX IF NOT EXISTS idx_festival_schedules_due ON public.festival_schedules (status, schedule_at);

ALTER TABLE public.festival_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.festival_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.festival_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update for authenticated users" ON public.festival_schedules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete for authenticated users" ON public.festival_schedules FOR DELETE TO authenticated USING (true);

-- ════════════════════════════════════════════════════════════════════════
-- 3. festival_schedule_recipients — resolved per-recipient send queue
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.festival_schedule_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  schedule_id uuid NOT NULL REFERENCES public.festival_schedules(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.festival_contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Failed', 'Skipped')),
  message_id text,
  error_message text,
  sent_at timestamp with time zone,
  CONSTRAINT festival_schedule_recipients_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_fsr_schedule_status ON public.festival_schedule_recipients (schedule_id, status);

ALTER TABLE public.festival_schedule_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON public.festival_schedule_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- 4. festival_schedule_logs — audit trail written by the Edge Function
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.festival_schedule_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  schedule_id uuid NOT NULL REFERENCES public.festival_schedules(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.festival_schedule_recipients(id) ON DELETE CASCADE,
  level text DEFAULT 'info' CHECK (level IN ('info', 'error')),
  message text,
  raw_response jsonb
);

CREATE INDEX IF NOT EXISTS idx_fsl_schedule ON public.festival_schedule_logs (schedule_id);

ALTER TABLE public.festival_schedule_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for authenticated users" ON public.festival_schedule_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert for authenticated users" ON public.festival_schedule_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════
-- 5. whatsapp_templates — ALTER to capture header format + variable metadata
--    (existing table, populated by whatsappLogService.syncTemplates())
-- ════════════════════════════════════════════════════════════════════════
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS header_format text,             -- 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  ADD COLUMN IF NOT EXISTS body_variable_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS header_variable_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS example_body_params jsonb,       -- Meta's sample body values, e.g. ["John","500"]
  ADD COLUMN IF NOT EXISTS example_header_handle text;      -- Meta's sample header media handle/url, if any

-- ════════════════════════════════════════════════════════════════════════
-- 6. Storage bucket for header media uploads
-- ════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('festival-media', 'festival-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read festival-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'festival-media');
CREATE POLICY "Authenticated upload festival-media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'festival-media');

-- ════════════════════════════════════════════════════════════════════════
-- 7. pg_cron — tick every 5 minutes to run due/in-progress schedules
--    (Requires the pg_cron and pg_net extensions enabled in Supabase:
--     Database → Extensions → enable "pg_cron" and "pg_net")
-- ════════════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'festival-scheduler-tick',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/festival-scheduler-run',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <YOUR_ANON_KEY>'
               ),
    body    := '{}'::jsonb
  );
  $$
);
```

Replace `<YOUR_PROJECT_REF>` and `<YOUR_ANON_KEY>` with your Supabase project's values before running step 7.

To later remove/change the cron schedule: `SELECT cron.unschedule('festival-scheduler-tick');`

---

## 2. Deploy the `festival-scheduler-run` Edge Function

### Step 2.1: Define the function

Create a new function named `festival-scheduler-run` in your Supabase project (via the Supabase CLI or the Dashboard's Edge Functions editor) with this logic:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const WHATSAPP_API_URL = Deno.env.get("WHATSAPP_API_URL") ?? "https://graph.facebook.com/v21.0"
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")
const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

const MEDIA_KEY: Record<string, string> = { IMAGE: "image", VIDEO: "video", DOCUMENT: "document" }
const BATCH_SIZE = 40          // recipients processed per invocation, per schedule
const MAX_SCHEDULES_PER_TICK = 3

// Resolve a "field" variable against a contact row (or the schedule's own
// occasion name), supporting dotted paths into extra_fields
function resolveField(contact: any, path: string, occasion: string) {
  if (path === "occasion") return occasion
  if (path === "name") return contact.name
  if (path === "phone_number") return contact.phone_number
  if (path === "email") return contact.email
  if (path.startsWith("extra_fields.")) {
    const key = path.slice("extra_fields.".length)
    return contact.extra_fields?.[key]
  }
  return contact.extra_fields?.[path]
}

// WhatsApp templates already wrap {{n}} in their own *bold*/_italic_/~strike~
// markers in the template body text. If a variable's value also contains one
// of those characters (e.g. an occasion typed as "*Holi"), it collides with
// the template's own marker and shows up as a stray/mismatched asterisk
// (e.g. "**Holi*"). Strip them so only the template's own formatting shows.
function stripMarkupChars(value: any) {
  return String(value ?? "").replace(/[*_~`]/g, "").trim()
}

function buildComponents(headerFormat: string, variableMapping: Record<string, any>, contact: any, occasion: string) {
  const components: any[] = []

  if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && variableMapping.header_media) {
    const key = MEDIA_KEY[headerFormat]
    components.push({ type: "header", parameters: [{ type: key, [key]: { link: variableMapping.header_media } }] })
  } else if (headerFormat === "TEXT" && variableMapping.header) {
    const entry = variableMapping.header
    const value = entry?.type === "field" ? resolveField(contact, entry.value, occasion) : entry?.value
    components.push({ type: "header", parameters: [{ type: "text", text: stripMarkupChars(value) || "N/A" }] })
  }

  const bodyIndices = Object.keys(variableMapping)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b)

  if (bodyIndices.length > 0) {
    const bodyParams = bodyIndices.map((idx) => {
      const entry = variableMapping[String(idx)]
      const value = entry?.type === "field" ? resolveField(contact, entry.value, occasion) : entry?.value
      return { type: "text", text: stripMarkupChars(value) || "N/A" }
    })
    components.push({ type: "body", parameters: bodyParams })
  }

  return components
}

async function sendOne(phone: string, templateName: string, language: string, components: any[]) {
  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: { name: templateName, language: { code: language }, components },
    }),
  })
  const result = await res.json()
  return { ok: res.ok, result }
}

serve(async () => {
  const nowIso = new Date().toISOString()

  // 1. Promote due 'Scheduled' rows to 'Running'
  await supabase
    .from("festival_schedules")
    .update({ status: "Running", last_run_at: nowIso })
    .eq("status", "Scheduled")
    .lte("schedule_at", nowIso)

  // 2. Pull active ('Running') schedules to process/resume this tick
  const { data: schedules } = await supabase
    .from("festival_schedules")
    .select("*, whatsapp_templates(header_format, language)")
    .eq("status", "Running")
    .limit(MAX_SCHEDULES_PER_TICK)

  const summary: any[] = []

  for (const schedule of schedules ?? []) {
    const headerFormat = schedule.whatsapp_templates?.header_format || "NONE"
    const language = schedule.whatsapp_templates?.language || "en"

    const { data: recipients } = await supabase
      .from("festival_schedule_recipients")
      .select("*, festival_contacts(*)")
      .eq("schedule_id", schedule.id)
      .eq("status", "Pending")
      .limit(BATCH_SIZE)

    let sent = 0, failed = 0

    for (const r of recipients ?? []) {
      const contact = r.festival_contacts
      if (!contact?.phone_number) {
        await supabase.from("festival_schedule_recipients").update({
          status: "Failed", error_message: "Missing contact/phone number",
        }).eq("id", r.id)
        failed++
        continue
      }

      const components = buildComponents(headerFormat, schedule.variable_mapping || {}, contact, schedule.occasion)
      const { ok, result } = await sendOne(contact.phone_number, schedule.template_name, language, components)

      if (ok) {
        sent++
        await supabase.from("festival_schedule_recipients").update({
          status: "Sent", message_id: result.messages?.[0]?.id, sent_at: new Date().toISOString(),
        }).eq("id", r.id)
        await supabase.from("festival_schedule_logs").insert({
          schedule_id: schedule.id, recipient_id: r.id, level: "info",
          message: `Sent to ${contact.phone_number}`, raw_response: result,
        })
      } else {
        failed++
        const apiErr = result.error?.message || "Send failed"
        await supabase.from("festival_schedule_recipients").update({
          status: "Failed", error_message: apiErr,
        }).eq("id", r.id)
        await supabase.from("festival_schedule_logs").insert({
          schedule_id: schedule.id, recipient_id: r.id, level: "error",
          message: apiErr, raw_response: result,
        })
      }
    }

    if (sent > 0 || failed > 0) {
      await supabase
        .from("festival_schedules")
        .update({
          completed_recipients: (schedule.completed_recipients || 0) + sent,
          failed_recipients: (schedule.failed_recipients || 0) + failed,
        })
        .eq("id", schedule.id)
    }

    // 3. Check if schedule is fully done (no Pending left)
    const { count: pendingLeft } = await supabase
      .from("festival_schedule_recipients")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", schedule.id)
      .eq("status", "Pending")

    if ((pendingLeft ?? 0) === 0) {
      const { count: failedCount } = await supabase
        .from("festival_schedule_recipients")
        .select("id", { count: "exact", head: true })
        .eq("schedule_id", schedule.id)
        .eq("status", "Failed")

      const allFailed = (failedCount ?? 0) > 0 && (failedCount ?? 0) === schedule.total_recipients

      await supabase.from("festival_schedules").update({
        status: allFailed ? "Failed" : "Completed",
        completed_at: new Date().toISOString(),
      }).eq("id", schedule.id)
    }

    summary.push({ schedule_id: schedule.id, sent, failed })
  }

  return new Response(JSON.stringify({ processed: summary.length, summary }), {
    status: 200, headers: { "Content-Type": "application/json" },
  })
})
```

### Step 2.2: Set Edge Function secrets

In **Supabase Dashboard → Project Settings → Edge Functions**, set:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — usually set automatically by Supabase.
- `WHATSAPP_API_URL` — same value as `VITE_WHATSAPP_API_URL` (e.g. `https://graph.facebook.com/v21.0`).
- `WHATSAPP_PHONE_NUMBER_ID` — same value as `VITE_WHATSAPP_PHONE_NUMBER_ID`.
- `WHATSAPP_ACCESS_TOKEN` — same value as `VITE_WHATSAPP_ACCESS_TOKEN`.

(Deno Edge Functions cannot read Vite's `.env`/`VITE_*` vars — they must be re-declared as Edge Function secrets.)

### Step 2.3: Test manually

Use the Dashboard's **Edge Functions → festival-scheduler-run → Invoke** button (or `curl` with your anon key) to run it on demand before relying on the cron tick — useful for testing against a schedule whose `schedule_at` you've set a few minutes in the past.

---

## 3. Pause / Resume semantics

- **Pause**: setting `festival_schedules.status = 'Paused'` removes the row from the `status='Running'`/`'Scheduled' AND due` query set — the next cron tick skips it entirely.
- **Resume**: setting `status` back to `'Running'` (if some recipients already sent) or `'Scheduled'` (if none have started, `schedule_at` already in the past) makes it eligible again on the next tick.
- **Batching**: only `BATCH_SIZE` (40) pending recipients are processed per schedule per tick, so large audiences span multiple 5-minute ticks without hitting Edge Function time limits. `status` stays `'Running'` until no `'Pending'` recipients remain.
- **Completion**: a schedule flips to `'Completed'` once all recipients are non-Pending, unless *every* recipient failed, in which case it flips to `'Failed'`.
