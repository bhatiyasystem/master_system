import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  const { data, error } = await supabase.from('purchase_deliveries').select('bill_image_url').limit(1);
  if (error) {
    console.error('Error selecting bill_image_url:', error);
  } else {
    console.log('Success! Data:', data);
  }
}

inspect();
