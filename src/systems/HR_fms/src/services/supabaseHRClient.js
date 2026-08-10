/**
 * supabaseHRClient.js
 * Dedicated Supabase client for the HR FMS module.
 *
 * Uses SEPARATE credentials (VITE_HR_SUPABASE_URL / VITE_HR_SUPABASE_ANON_KEY)
 * from the master system Supabase project.
 *
 * To configure:
 *   1. Go to your HR FMS Supabase project → Settings → API
 *   2. Copy "Project URL" → VITE_HR_SUPABASE_URL in .env
 *   3. Copy "anon public" key → VITE_HR_SUPABASE_ANON_KEY in .env
 */

import { createClient } from '@supabase/supabase-js';

const hrSupabaseURL = import.meta.env.VITE_HR_SUPABASE_URL;
const hrSupabaseKey = import.meta.env.VITE_HR_SUPABASE_ANON_KEY;

// Safe to expose for browser diagnostics; this is the public project URL, not a key.
export const hrSupabaseProjectUrl = hrSupabaseURL || '';

if (!hrSupabaseURL || hrSupabaseURL === 'YOUR_HR_FMS_SUPABASE_URL_HERE') {
  console.warn(
    '[HR FMS] ⚠ Supabase not configured.\n' +
    'Add VITE_HR_SUPABASE_URL and VITE_HR_SUPABASE_ANON_KEY to your .env file.'
  );
}

const hrSupabase = createClient(hrSupabaseURL || '', hrSupabaseKey || '', {
  auth: {
    persistSession: false,   // HR FMS uses its own auth, not the master session
    autoRefreshToken: true,
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

export default hrSupabase;
