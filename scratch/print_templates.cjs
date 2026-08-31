const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('whatsapp_templates').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("whatsapp_templates count:", data.length);
    data.forEach(t => {
      console.log(`- Template: "${t.name}", body_text: "${t.body_text}"`);
    });
  }
}

check();
