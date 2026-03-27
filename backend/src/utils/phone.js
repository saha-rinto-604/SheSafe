function normalizePhoneNumber(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function isValidBdPhone(value) {
  return /^01[3-9]\d{8}$/.test(value);
}

module.exports = {
  normalizePhoneNumber,
  isValidBdPhone,
};
