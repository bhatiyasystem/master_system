import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZnZtZGp0YXhrZnVzZ3ZnamJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIxNDg2NywiZXhwIjoyMDkzNzkwODY3fQ.OmYYZiH2zwwhMblmv1GRx37XhHtdSlOQeD-3dSl-OdM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking festival_schedules...");
  const { data: schedules } = await supabase.from('festival_schedules').select('*').order('created_at', { ascending: false }).limit(2);
  console.log("Schedules:", JSON.stringify(schedules, null, 2));

  console.log("\nChecking festival_schedule_recipients...");
  const { data: recipients } = await supabase.from('festival_schedule_recipients').select('*, festival_contacts(name, phone_number)').order('created_at', { ascending: false }).limit(3);
  console.log("Recipients:", JSON.stringify(recipients, null, 2));

  console.log("\nChecking festival_schedule_logs...");
  const { data: logs } = await supabase.from('festival_schedule_logs').select('*').order('created_at', { ascending: false }).limit(3);
  console.log("Logs:", JSON.stringify(logs, null, 2));
}

run();
