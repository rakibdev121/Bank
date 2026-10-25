export function formatBDT(amount, showSign = false) {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  const prefix = showSign ? (amount >= 0 ? '+৳' : '-৳') : '৳';
  return `${prefix}${formatted}`;
}

// 1,00,00,000 -> "1.00 Crore" style summary for big reserve numbers
export function formatCompactBDT(amount) {
  const a = Math.abs(amount);
  if (a >= 1e7) return `৳${(amount / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `৳${(amount / 1e5).toFixed(2)} Lakh`;
  return formatBDT(amount);
}

export function formatDate(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function newRequestId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
