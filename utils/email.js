const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

const LOCAL_PART_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PART_RE = /^[A-Za-z0-9.-]+$/;
const DOMAIN_LABEL_RE = /^[A-Za-z0-9-]+$/;

const isValidDomainLabel = (label) =>
  label.length > 0 &&
  label.length <= MAX_LABEL_LENGTH &&
  DOMAIN_LABEL_RE.test(label) &&
  !label.startsWith('-') &&
  !label.endsWith('-');

export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const isAcceptedEmail = (value) => {
  const email = normalizeEmail(value);
  if (!email || email.length > MAX_EMAIL_LENGTH) return false;

  const firstAt = email.indexOf('@');
  const lastAt = email.lastIndexOf('@');
  if (firstAt <= 0 || firstAt !== lastAt) return false;

  const localPart = email.slice(0, firstAt);
  const domainPart = email.slice(firstAt + 1);

  if (!localPart || !domainPart) return false;
  if (localPart.length > MAX_LOCAL_LENGTH || domainPart.length > MAX_DOMAIN_LENGTH) return false;
  if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
  if (localPart.includes('..') || domainPart.includes('..')) return false;
  if (domainPart.startsWith('.') || domainPart.endsWith('.')) return false;
  if (!LOCAL_PART_RE.test(localPart) || !DOMAIN_PART_RE.test(domainPart)) return false;

  const labels = domainPart.split('.');
  if (!labels.length) return false;
  return labels.every(isValidDomainLabel);
};
