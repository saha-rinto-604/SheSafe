function normalizePhoneNumber(value) {
  let phone = String(value || '').trim().replace(/[\s-]+/g, '');
  if (phone.startsWith('00')) {
    phone = `+${phone.slice(2)}`;
  }
  if (/^01[3-9]\d{8}$/.test(phone)) {
    return `+880${phone.slice(1)}`;
  }
  if (/^8801[3-9]\d{8}$/.test(phone)) {
    return `+${phone}`;
  }
  return phone;
}

function isValidBdPhone(value) {
  return /^\+8801[3-9]\d{8}$/.test(normalizePhoneNumber(value));
}

function phoneSearchVariants(value) {
  const raw = String(value || '').trim().replace(/[\s-]+/g, '');
  const normalized = normalizePhoneNumber(raw);
  const variants = [
    normalized,
    raw,
  ];

  if (/^\+8801[3-9]\d{8}$/.test(normalized)) {
    variants.push(`0${normalized.slice(4)}`);
    variants.push(normalized.slice(1));
  }

  return [...new Set(variants.filter(Boolean))];
}

module.exports = {
  normalizePhoneNumber,
  isValidBdPhone,
  phoneSearchVariants,
};
