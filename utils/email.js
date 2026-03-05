import { resolve4, resolve6, resolveMx } from 'dns/promises';

const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const DNS_TIMEOUT_MS = 2500;
const DNS_CACHE_TTL_MS = 1000 * 60 * 10;

const LOCAL_PART_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const DOMAIN_PART_RE = /^[A-Za-z0-9.-]+$/;
const DOMAIN_LABEL_RE = /^[A-Za-z0-9-]+$/;
const domainLookupCache = new Map();

const isValidDomainLabel = (label) =>
  label.length > 0 &&
  label.length <= MAX_LABEL_LENGTH &&
  DOMAIN_LABEL_RE.test(label) &&
  !label.startsWith('-') &&
  !label.endsWith('-');

const getDomainFromEmail = (value) => {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  if (at <= 0) return '';
  return email.slice(at + 1);
};

const getSingleLabelAllowlist = () => {
  const envValue = String(process.env.SINGLE_LABEL_EMAIL_ALLOWLIST || 'irk');
  return new Set(
    envValue
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
};

const withTimeout = (promise, timeoutMs = DNS_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dns_timeout')), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const isTransientDnsError = (error) => {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('dns_timeout')) return true;
  return code === 'EAI_AGAIN' || code === 'ETIMEOUT' || code === 'ESERVFAIL';
};

const readDomainCache = (domain) => {
  const record = domainLookupCache.get(domain);
  if (!record) return null;
  if (Date.now() - record.ts > DNS_CACHE_TTL_MS) {
    domainLookupCache.delete(domain);
    return null;
  }
  return record.value;
};

const writeDomainCache = (domain, value) => {
  domainLookupCache.set(domain, { value, ts: Date.now() });
};

const hasDomainRecords = async (domain) => {
  const cached = readDomainCache(domain);
  if (cached !== null) return cached;

  let transientFailure = false;

  const check = async (resolver) => {
    try {
      const records = await withTimeout(resolver(domain));
      return Array.isArray(records) && records.length > 0;
    } catch (error) {
      if (isTransientDnsError(error)) transientFailure = true;
      return false;
    }
  };

  const [mxFound, aFound, aaaaFound] = await Promise.all([
    check(resolveMx),
    check(resolve4),
    check(resolve6),
  ]);

  const valid = mxFound || aFound || aaaaFound || transientFailure;
  writeDomainCache(domain, valid);
  return valid;
};

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

export const hasDeliverableDomain = async (value) => {
  const email = normalizeEmail(value);
  if (!isAcceptedEmail(email)) {
    return {
      ok: false,
      code: 'email_format_invalid',
      message: 'Ingresa un correo valido.',
    };
  }

  const shouldCheckDns = String(process.env.CHECK_EMAIL_DOMAIN_DNS || 'true') === 'true';
  const skipDns = String(process.env.SKIP_EMAIL_DNS_CHECK || '').toLowerCase() === 'true';
  if (!shouldCheckDns || skipDns || process.env.NODE_ENV === 'test') {
    return { ok: true };
  }

  const domain = getDomainFromEmail(email);
  if (!domain) {
    return {
      ok: false,
      code: 'email_domain_invalid',
      message: 'El dominio del correo no es valido.',
    };
  }

  const labels = domain.split('.').filter(Boolean);
  if (labels.length === 1) {
    const allowlist = getSingleLabelAllowlist();
    if (!allowlist.has(domain)) {
      return {
        ok: false,
        code: 'email_domain_invalid',
        message: 'El dominio del correo no existe o no acepta registros.',
      };
    }
    return { ok: true };
  }

  const resolvable = await hasDomainRecords(domain);
  if (!resolvable) {
    return {
      ok: false,
      code: 'email_domain_invalid',
      message: 'No se pudo validar ese dominio de correo. Revisa que este bien escrito.',
    };
  }

  return { ok: true };
};
