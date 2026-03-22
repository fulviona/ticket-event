/**
 * Estrae un singolo URL https valido (evita incolla doppio tipo "https https://..." o due link attaccati).
 */
export function sanitizeTicketUrlInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();
  const matches = s.match(/https:\/\/[a-zA-Z0-9][a-zA-Z0-9./?#&=%_*:\-]*/gi);
  if (!matches || matches.length === 0) return s;
  const cleaned = matches.map((m) => m.replace(/[^a-zA-Z0-9/:?#&=%._\-]+$/g, ''));
  const withTicket = cleaned.find((u) => /\/ticket\//i.test(u));
  return withTicket || cleaned[0] || s;
}
