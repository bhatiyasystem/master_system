const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env
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

// Mock browser global window/localStorage
global.window = {};
global.localStorage = {
  getItem: (key) => '1',
  setItem: () => {},
  clear: () => {}
};

// Set Env variables for VITE
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

const purchaseService = require('../src/systems/purchase/services/purchaseService.js');

async function check() {
  console.log("Calling fetchPurchasePendingCounts directly from purchaseService...");
  try {
    const counts = await purchaseService.fetchPurchasePendingCounts();
    console.log("Counts result:", counts);
  } catch (err) {
    console.error("FAILED to fetch counts:", err);
  }
}

check();
