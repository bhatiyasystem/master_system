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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Simple evaluateFormula mockup
function evaluateFormula(expr) {
  if (!expr) return 0;
  try {
    const clean = expr.replace(/[^0-9+\-*/().\s]/g, '');
    return Function(`"use strict"; return (${clean})`)() || 0;
  } catch (e) {
    return 0;
  }
}

async function check() {
  console.log("Fetching pending counts...");
  try {
    const [indentsRes, posRes, deliveriesRes, approvalsRes, paymentsRes] = await Promise.all([
      supabase.from('purchase_indents').select('id, status, order_formula, po_id'),
      supabase.from('purchase_pos').select('id'),
      supabase.from('purchase_deliveries').select('id, po_id, received'),
      supabase.from('purchase_payment_approvals').select('id, po_id, status'),
      supabase.from('purchase_payments').select('id, payment_approval_id'),
    ]);

    if (indentsRes.error) throw indentsRes.error;
    if (posRes.error) throw posRes.error;
    if (deliveriesRes.error) throw deliveriesRes.error;
    if (approvalsRes.error) throw approvalsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const indents = indentsRes.data || [];
    const pos = posRes.data || [];
    const deliveries = deliveriesRes.data || [];
    const approvals = approvalsRes.data || [];
    const payments = paymentsRes.data || [];

    const approvalPending = indents.filter(
      (i) => i.status === 'Pending' && evaluateFormula(i.order_formula) > 0
    ).length;

    const poPending = indents.filter((i) => i.status === 'Approved' && !i.po_id).length;

    const deliveredPoIds = new Set(deliveries.filter((d) => d.po_id).map((d) => d.po_id));
    const deliveryPending = pos.filter((p) => !deliveredPoIds.has(p.id)).length;

    const receivingPending = deliveries.filter((d) => !d.received).length;

    console.log("Counts:", {
      approvalPending,
      poPending,
      deliveryPending,
      receivingPending
    });
  } catch (err) {
    console.error("Error fetching counts:", err);
  }
}

check();
