/**
 * True se il testo sembra una schedina reale (non solo home/cookie wall Sportium).
 */
function pageTextLooksLikeSportiumTicket(text) {
  if (!text || text.length < 80) return false;
  const t = text.replace(/\s+/g, ' ');
  const hasMatchLine =
    /[a-zà-ú0-9][a-zà-ú0-9\s.'-]{1,45}\s+vs\.?\s+[a-zà-ú0-9][a-zà-ú0-9\s.'-]{1,45}/i.test(t) ||
    (/[a-zà-ú0-9][a-zà-ú0-9\s.'-]{2,}\s+[-–]\s+[a-zà-ú0-9][a-zà-ú0-9\s.'-]{2,}/i.test(t) &&
      !/\b(login|registrati|cookie policy|benvenut)\b/i.test(t));
  const hasQuotaOrGiocata =
    /\d+[.,]\d{2}/.test(t) &&
    /\b(giocata|quota|importo|aams|adm|venduto|scommess|vincita\s*potenziale)\b/i.test(t);
  const hasAamsId = /\bAAMS:\s*[A-Z0-9]{8,}/i.test(t) || /\bADM:\s*[A-Z0-9]{8,}/i.test(t);
  return Boolean((hasMatchLine && hasQuotaOrGiocata) || (hasAamsId && hasQuotaOrGiocata && t.length > 400));
}

module.exports = { pageTextLooksLikeSportiumTicket };
