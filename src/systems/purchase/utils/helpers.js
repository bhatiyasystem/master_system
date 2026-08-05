export function fmt(n) {
  return (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function uniqueValues(arr, key) {
  return Array.from(new Set(arr.map((i) => i[key]).filter(Boolean))).sort();
}

export function findColIndex(headers, keywords) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim().toLowerCase();
    if (keywords.some((k) => h === k)) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim().toLowerCase();
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

export function generatePONo(counter) {
  const yr = new Date().getFullYear();
  return 'BE/PO/' + yr + '-' + String(yr + 1 - 2000) + '/' + String(counter).padStart(3, '0');
}
