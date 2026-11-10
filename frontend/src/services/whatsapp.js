export function getWhatsAppUrl(phone, message = '') {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) return '';
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${withCountryCode}${query}`;
}

export function getClientPhone(client) {
  const row = client?.dadosPlanilha || {};
  const direct = client?.telefone || client?.whatsapp || client?.WhatsApp || row['Telefone / WhatsApp'];
  if (direct) return String(direct);
  const ddd = row.DDD || row['DDD 1'] || '';
  const phone = row['TELEFONE 1'] || '';
  return [ddd, phone].filter(Boolean).join(' ');
}
