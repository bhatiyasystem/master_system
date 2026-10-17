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

const rawHRUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HR_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_HR_SUPABASE_URL) || '';
const rawHRKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HR_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_HR_SUPABASE_ANON_KEY) || '';

const fallbackUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 'https://sffvmdjtaxkfusgvgjbf.supabase.co';
const fallbackKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 'sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS';

const isInvalidUrl = !rawHRUrl || rawHRUrl === 'YOUR_HR_FMS_SUPABASE_URL_HERE' || rawHRUrl.includes('vgmhuuzskijnvsagzrzq');
const isInvalidKey = !rawHRKey || rawHRKey.includes('TP0_P7TRbf5cz9p9Hm15hg_MXt4gBSD');

const hrSupabaseURL = (isInvalidUrl ? fallbackUrl : rawHRUrl).replace(/\/+$/, '');
const hrSupabaseKey = isInvalidKey ? fallbackKey : rawHRKey;

// Safe to expose for browser diagnostics; this is the public project URL, not a key.
export const hrSupabaseProjectUrl = hrSupabaseURL || '';

const hrSupabase = createClient(hrSupabaseURL || '', hrSupabaseKey || '', {
  auth: {
    persistSession: false,   // HR FMS uses its own auth, not the master session
    autoRefreshToken: true,
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

export default hrSupabase;
