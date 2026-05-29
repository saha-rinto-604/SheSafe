function normalizePhoneNumber(value) {
  let phone = String(value || '').trim().replace(/[\s-]+/g, '');
  if (phone.startsWith('+880')) {
    phone = `0${phone.slice(4)}`;
  } else if (phone.startsWith('880')) {
    phone = `0${phone.slice(3)}`;
  }
  return phone;
}

function isValidBdPhone(value) {
  return /^01[3-9]\d{8}$/.test(normalizePhoneNumber(value));
}

function phoneSearchVariants(value) {
  const raw = String(value || '').trim().replace(/[\s-]+/g, '');
  const normalized = normalizePhoneNumber(raw);
  const variants = [
    normalized,
    raw,
  ];

  if (/^01[3-9]\d{8}$/.test(normalized)) {
    variants.push(`+880${normalized.slice(1)}`);
    variants.push(`880${normalized.slice(1)}`);
  }

  return [...new Set(variants.filter(Boolean))];
}

module.exports = {
  normalizePhoneNumber,
  isValidBdPhone,
  phoneSearchVariants,
};
