import fs from 'fs';

const content = fs.readFileSync('src/systems/whatsapp-management/src/pages/admin/WhatsappHistory.jsx', 'utf8');
const lines = content.split('\n');

const query = 'showtoast';
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes(query)) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
