import supabase from '../../../../SupabaseClient';

/*
  ── SQL to run once in Supabase SQL editor ───────────────────────────────────

  -- 1. Add dob column to users table
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob DATE;

  -- 2. Drop old tables (created earlier, no longer needed)
  DROP TABLE IF EXISTS public.employee_birthdays CASCADE;
  DROP TABLE IF EXISTS public.greetings_config CASCADE;

  -- 3. Create (or recreate) birthday_greetings tracking table
  DROP TABLE IF EXISTS public.birthday_greetings;
  CREATE TABLE public.birthday_greetings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    dob DATE NOT NULL,
    scheduled_for DATE NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Sent', 'Failed')),
    template_name TEXT DEFAULT 'birthday_wishes',
    message_id TEXT,
    error_message TEXT,
    UNIQUE (user_id, scheduled_for)
  );

  -- 4. Cron job: invoke edge function every day at 11:00 AM IST (05:30 UTC)
  --    (Requires pg_cron + pg_net extensions enabled in Supabase)
  SELECT cron.schedule(
    'birthday-greetings-daily',
    '30 5 * * *',
    $$
    SELECT net.http_post(
      url        := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/birthday-greetings',
      headers    := jsonb_build_object(
                      'Content-Type',  'application/json',
                      'Authorization', 'Bearer <YOUR_ANON_KEY>'
                    ),
      body       := '{}'::jsonb
    );
    $$
  );
*/

// ── IST helpers ──────────────────────────────────────────────────────────────

const getISTDate = () => {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    iso: ist.toISOString().split('T')[0],
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
  };
};

// ── Today's birthday users (from users table) ─────────────────────────────────

export const fetchTodaysBirthdayUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, user_name, number, profile_image, dob, role, status')
    .eq('status', 'active')
    .not('dob', 'is', null);

  if (error) throw error;

  const { month, day } = getISTDate();
  return (data || []).filter((u) => {
    const d = new Date(u.dob);
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });
};

// ── Birthday greetings log ────────────────────────────────────────────────────

export const fetchTodaysBirthdayGreetings = async () => {
  const { iso } = getISTDate();
  const { data, error } = await supabase
    .from('birthday_greetings')
    .select('*')
    .eq('scheduled_for', iso);
  if (error) throw error;
  return data || [];
};

export const fetchBirthdayGreetings = async (filters = {}) => {
  let query = supabase
    .from('birthday_greetings')
    .select('*')
    .order('scheduled_for', { ascending: false });

  if (filters.status && filters.status !== 'All') query = query.eq('status', filters.status);
  if (filters.dateFrom) query = query.gte('scheduled_for', filters.dateFrom);
  if (filters.dateTo) query = query.lte('scheduled_for', filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// ── Invoke edge function (admin manual trigger) ───────────────────────────────

export const triggerBirthdayEdgeFunction = async () => {
  const { data, error } = await supabase.functions.invoke('birthday-greetings');
  if (error) throw error;
  return data;
};
