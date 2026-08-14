const url = 'https://sffvmdjtaxkfusgvgjbf.supabase.co/rest/v1/whatsapp_logs?select=status,error_message,error_code,phone_number,created_at,error_details,message_content&order=created_at.desc&limit=5';
const headers = {
  'apikey': 'sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS',
  'Authorization': 'Bearer sb_publishable_d08mS6BZwdJgaAuC2deEFg_4TBm0GcS'
};

async function main() {
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
