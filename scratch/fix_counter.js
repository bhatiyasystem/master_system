import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data: indents } = await supabase.from('purchase_indents').select('unique_no');
  let max = 0;
  for (const ind of indents || []) {
    const match = ind.unique_no.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }
  
  const year = new Date().getFullYear();
  const key = 'indent_' + year;
  
  const { error } = await supabase.from('purchase_counters').upsert({ counter_key: key, next_value: max + 1 });
  if (error) {
    console.error('Error updating counter:', error);
  } else {
    console.log('Fixed counter to', max + 1);
  }
}

fix();
