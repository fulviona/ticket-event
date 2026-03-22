/**
 * Refertazione automatica (calcio) tramite API-Football (dati risultato reali).
 * Non è la refertazione ADM ufficiale (nessuna API pubblica dal monopolio): è un tracker
 * basato su risultati sportivi; il cliente non deve fare nulla se AUTO_SETTLEMENT è attivo.
 *
 * Env: API_FOOTBALL_KEY (https://www.api-football.com/)
 */
const Ticket = require('../models/Ticket');
const { syncPointsOnTicketStatusChange } = require('../utils/ticketPoints');

const API_BASE = 'https://v3.football.api-sports.io';

/** Cache in-memory: date string -> { at, data } */
const fixturesCache = new Map();
const CACHE_MS = 10 * 60 * 1000;

function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nomi italiani comuni → chiavi di ricerca in inglese */
const TEAM_HINTS = [
  [/barcellona|fc\s*barcelona/i, 'barcelona'],
  [/inter\s*milano|^inter$/i, 'inter'],
  [/milan(?!\w)/i, 'milan'],
  [/roma(?!\w)/i, 'roma'],
  [/napoli/i, 'napoli'],
  [/lazio(?!\w)/i, 'lazio'],
  [/atalanta/i, 'atalanta'],
  [/juventus|juve\b/i, 'juventus'],
  [/torino(?!\w)/i, 'torino'],
  [/fiorentina/i, 'fiorentina'],
  [/bologna(?!\w)/i, 'bologna'],
  [/sassuolo/i, 'sassuolo'],
  [/verona(?!\w)/i, 'verona'],
  [/empoli/i, 'empoli'],
  [/lecce(?!\w)/i, 'lecce'],
  [/cagliari/i, 'cagliari'],
  [/genoa(?!\w)/i, 'genoa'],
  [/como(?!\w)/i, 'como'],
  [/parma(?!\w)/i, 'parma'],
  [/udinese/i, 'udinese'],
  [/cremonese/i, 'cremonese'],
  [/venezia/i, 'venezia'],
  [/pisa(?!\w)/i, 'pisa'],
];

function searchHint(name) {
  const n = String(name);
  for (const [re, hint] of TEAM_HINTS) {
    if (re.test(n)) return hint;
  }
  return null;
}

function teamLikelyMatch(userName, apiName) {
  const u = normalizeName(userName);
  const a = normalizeName(apiName);
  if (!u || !a) return false;
  if (u === a) return true;
  if (a.includes(u) || u.includes(a)) return true;
  const hint = searchHint(userName);
  if (hint && a.includes(hint)) return true;
  const wordsU = u.split(' ').filter((w) => w.length > 3);
  const wordsA = a.split(' ').filter((w) => w.length > 3);
  for (const w of wordsU) {
    if (wordsA.some((x) => x.includes(w) || w.includes(x))) return true;
  }
  return false;
}

function parseTeamsFromMatch(matchStr) {
  if (!matchStr || typeof matchStr !== 'string') return null;
  const m = matchStr.split(/\s+vs\.?\s+/i);
  if (m.length < 2) return null;
  return { home: m[0].trim(), away: m[1].trim() };
}

function isFootballBet(bet) {
  const s = `${bet.sport || ''} ${bet.competition || ''}`.toLowerCase();
  if (/calcio|football|soccer|serie\s*[ab]|premier|laliga|liga|champions|europa/i.test(s)) return true;
  if (!bet.sport || bet.sport.trim() === '') return true;
  return false;
}

function betNeedsSettlement(bet) {
  const r = bet.result;
  return r !== 'won' && r !== 'lost';
}

function evaluateBetOutcome(bet, homeGoals, awayGoals) {
  const hg = Number(homeGoals);
  const ag = Number(awayGoals);
  if (Number.isNaN(hg) || Number.isNaN(ag)) return { skip: true, reason: 'Punteggio non valido' };

  const selRaw = String(bet.selection || '').trim();
  const sel = selRaw.toUpperCase().replace(/\s+/g, ' ');
  const pred = String(bet.prediction || '').toUpperCase();
  const combined = `${pred} ${sel}`;

  let outcome1x2;
  if (hg > ag) outcome1x2 = '1';
  else if (hg < ag) outcome1x2 = '2';
  else outcome1x2 = 'X';

  const normSel = sel.replace(/\s/g, '');
  const is1x2 =
    bet.betType === '1X2' ||
    /^(1|X|2)$/.test(normSel) ||
    /ESITO\s+FINALE|1\s*X\s*2|RISULTATO\s+FINALE/i.test(combined);

  if (is1x2 && /^(1|X|2)$/.test(normSel)) {
    return { won: normSel === outcome1x2, detail: `1X2: esito ${outcome1x2}, scelta ${normSel}` };
  }

  if (bet.betType === 'Goal/No Goal' || /\bGG\b|\bNG\b|GOAL\s*\/\s*NO\s*GOAL/i.test(combined)) {
    const gg = hg > 0 && ag > 0;
    if (/^GG\b|GOAL|ENTRAMBE/i.test(sel) || sel.includes('GG')) {
      return { won: gg, detail: `GG/NG: GG=${gg}` };
    }
    if (/^NG\b|NO\s*GOAL/i.test(sel) || sel.includes('NG')) {
      return { won: !gg, detail: `GG/NG: NG=${!gg}` };
    }
  }

  if (bet.betType === 'Under/Over' || /U\/?O|OVER|UNDER/i.test(combined)) {
    const lineM = combined.match(/U\/?O\s*([\d.]+)|OVER\s*([\d.]+)|UNDER\s*([\d.]+)/i);
    const line = parseFloat(lineM ? lineM[1] || lineM[2] || lineM[3] : '2.5') || 2.5;
    const total = hg + ag;
    if (/OVER|^O\s|^O$|>/.test(sel) || sel === 'OVER') {
      return { won: total > line, detail: `O/U ${line}: tot ${total}, OVER` };
    }
    if (/UNDER|^U\s|^U$|</.test(sel) || sel === 'UNDER') {
      return { won: total < line, detail: `O/U ${line}: tot ${total}, UNDER` };
    }
  }

  return { skip: true, reason: `Tipo "${bet.betType}" non gestito in automatico` };
}

function pickFixtureForTeams(fixturesResponse, homeName, awayName) {
  const list = fixturesResponse?.response || [];
  for (const item of list) {
    const hn = item?.teams?.home?.name;
    const an = item?.teams?.away?.name;
    if (!hn || !an) continue;
    const a = teamLikelyMatch(homeName, hn) && teamLikelyMatch(awayName, an);
    const b = teamLikelyMatch(homeName, an) && teamLikelyMatch(awayName, hn);
    if (a || b) {
      const swap = !!b && !a;
      return { item, swap };
    }
  }
  return null;
}

function getFulltimeGoals(item) {
  const ft = item?.score?.fulltime;
  if (ft && ft.home != null && ft.away != null) {
    return { home: Number(ft.home), away: Number(ft.away) };
  }
  const g = item?.goals;
  if (g && g.home != null && g.away != null) {
    return { home: Number(g.home), away: Number(g.away) };
  }
  return null;
}

async function fetchFixturesForDate(dateStr, apiKey) {
  const now = Date.now();
  const cached = fixturesCache.get(dateStr);
  if (cached && now - cached.at < CACHE_MS) return cached.data;

  const url = `${API_BASE}/fixtures?date=${dateStr}&timezone=Europe/Rome`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
  });
  if (!res.ok) {
    throw new Error(`API-Football HTTP ${res.status}`);
  }
  const data = await res.json();
  fixturesCache.set(dateStr, { at: now, data });
  return data;
}

function formatDateIt(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function recomputeTicketAggregateStatus(bets) {
  if (bets.some((b) => b.result === 'lost')) return 'lost';
  const pending = bets.some((b) => b.result !== 'won' && b.result !== 'lost');
  if (pending) return 'pending';
  if (bets.every((b) => b.result === 'won')) return 'won';
  return 'lost';
}

/**
 * Elabora ticket in pending con scommesse calcio: aggiorna esiti e stato ticket.
 */
async function runAutoSettlementJob() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return { skipped: true, message: 'API_FOOTBALL_KEY non configurata' };
  }

  const tickets = await Ticket.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .limit(80)
    .exec();

  let ticketsUpdated = 0;
  let betsSettled = 0;
  const errors = [];

  for (const ticket of tickets) {
    let changed = false;
    const previousStatus = ticket.status;

    for (let i = 0; i < ticket.bets.length; i++) {
      const bet = ticket.bets[i];
      if (!betNeedsSettlement(bet)) continue;
      if (!isFootballBet(bet)) continue;
      if (!bet.eventDate) continue;

      const kickoff = new Date(bet.eventDate);
      const now = new Date();
      if (kickoff.getTime() > now.getTime() - 90 * 60 * 1000) continue;

      const teams = parseTeamsFromMatch(bet.match);
      if (!teams) continue;

      const dateStr = formatDateIt(kickoff);
      let fixturesData;
      try {
        fixturesData = await fetchFixturesForDate(dateStr, apiKey);
      } catch (e) {
        errors.push({ ticket: ticket._id, error: e.message });
        continue;
      }

      const picked = pickFixtureForTeams(fixturesData, teams.home, teams.away);
      if (!picked) continue;

      const { item, swap } = picked;
      const st = item?.fixture?.status?.short;
      if (!['FT', 'AET', 'PEN'].includes(String(st || ''))) continue;

      let goals = getFulltimeGoals(item);
      if (!goals) continue;
      if (swap) goals = { home: goals.away, away: goals.home };

      const ev = evaluateBetOutcome(bet, goals.home, goals.away);
      if (ev.skip) continue;

      ticket.bets[i].result = ev.won ? 'won' : 'lost';
      ticket.bets[i].score = `${goals.home}-${goals.away}`;
      ticket.bets[i].settlementInfo = `Auto API-Football (${ev.detail || 'ok'})`;
      changed = true;
      betsSettled += 1;
    }

    if (changed) {
      const newStatus = recomputeTicketAggregateStatus(ticket.bets);
      if (newStatus !== 'pending') {
        ticket.status = newStatus;
      }
      ticket.markModified('bets');
      await ticket.save();
      ticketsUpdated += 1;
      if (ticket.status !== previousStatus) {
        await syncPointsOnTicketStatusChange(ticket.user, previousStatus, ticket.status);
      }
    }
  }

  return {
    skipped: false,
    ticketsScanned: tickets.length,
    ticketsUpdated,
    betsSettled,
    errors: errors.length ? errors : undefined,
  };
}

module.exports = { runAutoSettlementJob, evaluateBetOutcome, parseTeamsFromMatch };
