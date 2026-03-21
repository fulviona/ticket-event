const express = require('express');
const multer = require('multer');
const path = require('path');
const { execSync } = require('child_process');
const Tesseract = require('tesseract.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const Ticket = require('../models/Ticket');
const { auth } = require('../middleware/auth');

puppeteer.use(StealthPlugin());

const router = express.Router();

// Salva in memoria (buffer), non su disco
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Solo immagini JPG, PNG o WebP'));
  },
});

// ===== Tipologie scommesse ADM/AAMS =====
const BET_TYPES = [
  // Cartellino giocatore (deve essere prima di Marcatore perché può contenere "sostituto")
  { pattern: /\bcartellino\b/i, type: 'Cartellino' },
  { pattern: /\bammonit[oa]\b/i, type: 'Cartellino' },
  { pattern: /\bammonizion[ei]\b/i, type: 'Cartellino' },
  { pattern: /\bespuls[oa]\b/i, type: 'Cartellino' },
  { pattern: /\bespulsion[ei]\b/i, type: 'Cartellino' },
  // Marcatore / Gol giocatore (combinati: segna o colpisce, segna o fa assist)
  { pattern: /\bsegna\s+o\s+(colpisce|fa\s+assist)/i, type: 'Marcatore' },
  { pattern: /\bsegna\b/i, type: 'Marcatore' },
  { pattern: /\bmarcatore\b/i, type: 'Marcatore' },
  { pattern: /\bmarc\.\b/i, type: 'Marcatore' },
  { pattern: /\bgoleador\b/i, type: 'Marcatore' },
  { pattern: /\bprimo\s*gol\b/i, type: 'Marcatore' },
  { pattern: /\bultimo\s*gol\b/i, type: 'Marcatore' },
  { pattern: /\banytime\b/i, type: 'Marcatore' },
  { pattern: /\bdoppietta\b/i, type: 'Marcatore' },
  // Palo/Traversa
  { pattern: /\bpalo[\s/]*traversa\b/i, type: 'Palo/Traversa' },
  // Assist
  { pattern: /\bfa\s+assist\b/i, type: 'Assist' },
  { pattern: /\bassist\b/i, type: 'Assist' },
  // Tiri in porta / Tiri totali
  { pattern: /\btiri?\s*(in\s*porta|totali|fuori)\b/i, type: 'Tiri' },
  { pattern: /\bshots?\s*on\s*target\b/i, type: 'Tiri' },
  // Under/Over con soglia
  { pattern: /\b(under|over)\s*[\d.,]+/i, type: 'Under/Over' },
  { pattern: /\bu[\s/]*o\s*[\d.,]+/i, type: 'Under/Over' },
  // Goal/No Goal
  { pattern: /\b(goal|no\s*goal|gol|no\s*gol)\b/i, type: 'Goal/No Goal' },
  { pattern: /\b(gg|ng)\b/, type: 'Goal/No Goal' },
  // Esito finale 1X2
  { pattern: /\besito\s*finale\b/i, type: '1X2' },
  { pattern: /\b1\s*x\s*2\b/i, type: '1X2' },
  // Doppia Chance
  { pattern: /\bdoppia\s*chance\b/i, type: 'Doppia Chance' },
  { pattern: /\bdc\s*(1t|2t|in|out)\b/i, type: 'Doppia Chance' },
  // Draw No Bet
  { pattern: /\b(draw\s*no\s*bet|dnb)\b/i, type: 'Draw No Bet' },
  // Handicap
  { pattern: /\bhandicap\b/i, type: 'Handicap' },
  { pattern: /\bhcap\b/i, type: 'Handicap' },
  { pattern: /\bh\.\s*[12x]/i, type: 'Handicap' },
  { pattern: /\bah\s*[12]/i, type: 'Handicap' },
  // Risultato esatto
  { pattern: /\b(risultato\s*esatto|ris\.?\s*es(?:atto)?)\b/i, type: 'Risultato Esatto' },
  // Parziale/Finale
  { pattern: /\bparziale[\s/]*finale\b/i, type: 'Parziale/Finale' },
  { pattern: /\b1t[\s/]*2t\b/i, type: 'Parziale/Finale' },
  { pattern: /\bprimo\s*tempo\b/i, type: 'Primo Tempo' },
  { pattern: /\bsecondo\s*tempo\b/i, type: 'Secondo Tempo' },
  // Combo
  { pattern: /\b[12x]\s*[+-]?\s*(?:over|under)\b/i, type: 'Combo 1X2+U/O' },
  { pattern: /\b[12x]\s*[-+]\s*(?:goal|gol)\b/i, type: 'Combo 1X2+GG/NG' },
  // Somma Goal / Multigol
  { pattern: /\b(somma|totale)\s*gol/i, type: 'Somma Goal' },
  { pattern: /\bmulti\s*gol/i, type: 'Multigol' },
  // Pari/Dispari
  { pattern: /\bpari[\s/]*dispari\b/i, type: 'Pari/Dispari' },
  { pattern: /\bp[\s/]*d\s*(cart|corner|1t|2t)\b/i, type: 'Pari/Dispari' },
  // Corner
  { pattern: /\b(corner|angoli|calci\s*d.angolo)\b/i, type: 'Corner' },
  // Supplementari
  { pattern: /\b(supplementari|overtime|extra\s*time)\b/i, type: 'Supplementari' },
  // Possesso palla
  { pattern: /\bpossesso\b/i, type: 'Possesso' },
  // Falli
  { pattern: /\bfalli?\s*(commess|subit)/i, type: 'Falli' },
  // Rigore
  { pattern: /\brigore\b/i, type: 'Rigore' },
  // Fuorigioco
  { pattern: /\bfuorigioco\b/i, type: 'Fuorigioco' },
  // Rimessa laterale
  { pattern: /\brimessa\b/i, type: 'Rimessa' },
  // Ribaltone
  { pattern: /\bribaltone\b/i, type: 'Ribaltone' },
  // Autorete
  { pattern: /\bautorete\b/i, type: 'Autorete' },
  // Squadra primo gol
  { pattern: /\bsquadra\s*(1|primo|1°)\s*gol/i, type: 'Squadra Primo Gol' },
];

function detectBetType(text) {
  for (const { pattern, type } of BET_TYPES) {
    if (pattern.test(text)) return type;
  }
  return 'N/D';
}

// ===== Regole di refertazione per tipo scommessa (fonti: ADM, Goldbet, SNAI, Sisal, Eurobet, eplay24) =====
const SETTLEMENT_RULES = {
  'Cartellino': 'Giallo=1pt, rosso diretto=2pt, doppio giallo=3pt (1+2). Max 3pt per giocatore. Standard: valgono solo cartellini a giocatori in campo. Se giocatore non partecipa: rimborsata.',
  'Marcatore': 'Il giocatore deve segnare almeno 1 gol nei 90\'+recupero. Autogol NON conta. Se non entra in campo: rimborsata. DUO/Tandem: vale anche il gol del sostituto diretto.',
  'Palo/Traversa': 'Il giocatore deve colpire almeno un palo o traversa. Se "O SUO SOSTITUTO": vale anche il sostituto. Se non partecipa: rimborsata.',
  'Assist': 'Il giocatore deve fornire l\'ultimo passaggio decisivo prima del gol (dati OPTA ufficiali). Se "O SUO SOSTITUTO": vale anche il sostituto. Se non partecipa: rimborsata.',
  'Under/Over': 'Conta il totale gol al 90\'+recupero. Supplementari e rigori NON contano. Per U/O giocatore (tiri, falli): dati OPTA ufficiali.',
  'Goal/No Goal': 'GOAL (GG): entrambe le squadre segnano almeno 1 gol. NO GOAL (NG): almeno una squadra non segna. Risultato al 90\'+recupero.',
  '1X2': '1=vittoria casa, X=pareggio, 2=vittoria ospite. Risultato al 90\'+recupero. Supplementari/rigori NON contano.',
  'Doppia Chance': '1X=casa o pareggio, 12=casa o ospite, X2=pareggio o ospite. Risultato al 90\'+recupero.',
  'Handicap': 'Europeo: 3 esiti (1/X/2) con handicap applicato. Asiatico: 2 esiti, possibile rimborso parziale su linee intere. Risultato al 90\'+recupero.',
  'Risultato Esatto': 'Pronostico esatto del punteggio al 90\'+recupero. "ALTRO" copre tutti i risultati non elencati.',
  'Parziale/Finale': 'Combinazione risultato 1T e risultato finale (es: 1/X = casa vince 1T, pareggio finale). Entrambe devono verificarsi.',
  'Combo 1X2+U/O': 'Risultato 1X2 + Under/Over. Entrambe le condizioni devono verificarsi al 90\'+recupero.',
  'Combo 1X2+GG/NG': 'Risultato 1X2 + Goal/No Goal. Entrambe le condizioni devono verificarsi al 90\'+recupero.',
  'Corner': 'Conta il numero di calci d\'angolo effettivamente battuti. Corner assegnati ma non battuti NON contano. Dati ufficiali.',
  'Pari/Dispari': 'PARI: totale gol pari (0, 2, 4...). DISPARI: totale gol dispari (1, 3, 5...). 0-0 = PARI. Risultato al 90\'+recupero.',
  'Somma Goal': 'Fascia esatta del totale gol nella partita al 90\'+recupero.',
  'Multigol': 'Totale gol deve rientrare nell\'intervallo (es: Multigol 1-3 = da 1 a 3 gol). Risultato al 90\'+recupero.',
  'Tiri': 'Tiri in porta: tentativi diretti nello specchio della porta. Palo/traversa NON conta come tiro in porta (standard). Tiri totali: include fuori e bloccati. Dati OPTA.',
  'Rigore': 'Almeno un calcio di rigore deve essere assegnato nei 90\'+recupero. Include rigori parati/sbagliati.',
  'Ribaltone': 'Una squadra deve andare in svantaggio e poi vincere. Non basta pareggiare dopo essere andati sotto.',
  'Autorete': 'Almeno un autogol deve essere segnato nella partita nei 90\'+recupero.',
  'Falli': 'Falli commessi dal giocatore. Solo quelli per cui l\'arbitro fischia fallo (vantaggio NON conta). Dati OPTA.',
  'Fuorigioco': 'Fuorigioco fischiati dall\'arbitro. Dati ufficiali della competizione.',
  'Squadra Primo Gol': 'Quale squadra segna il primo gol nella partita. Se 0-0: tutte le scommesse perdenti.',
};

function getSettlementInfo(betType, prediction) {
  // Cartellino PLUS / DUO / Ultra: "ANCHE IN PANCHINA E DOPO"
  if (betType === 'Cartellino' && /anche\s*in\s*panchina/i.test(prediction)) {
    let info = 'Cartellino PLUS (Goldbet) / DUO (Sisal) / Ultra (SNAI): il cartellino vale anche se ricevuto dalla PANCHINA, dopo la SOSTITUZIONE o dopo il FISCHIO FINALE. Include proteste durante l\'intervallo.';
    if (/o\s*suo\s*sostituto/i.test(prediction)) {
      info += ' Con "O SUO SOSTITUTO": vale anche il cartellino del sostituto diretto.';
    }
    info += ' Se il giocatore non e\' convocato/non partecipa: rimborsata. Giallo=1pt, rosso diretto=2pt, doppio giallo=3pt.';
    return info;
  }
  // Marcatore Plus: "SEGNA O COLPISCE PALO/TRAVERSA"
  if (/segna\s+o\s+colpisce\s+palo/i.test(prediction)) {
    let info = 'Marcatore PLUS (Goldbet) / DUO (Sisal) / Ultra (SNAI): VINTA se il giocatore segna almeno 1 gol OPPURE colpisce almeno un palo/traversa. Autogol NON conta.';
    if (/o\s*il?\s*suo\s*sostituto/i.test(prediction)) {
      info += ' Con "O IL SUO SOSTITUTO": vale anche se il sostituto diretto segna o colpisce il legno.';
    }
    info += ' Se non entra in campo: rimborsata. Vale nei 90\'+recupero+supplementari. Rigori esclusi. SNAI Ultra: gol annullati (es. VAR) contano come evento vincente.';
    return info;
  }
  // Segna o fa assist
  if (/segna\s+o\s+fa\s+assist/i.test(prediction)) {
    let info = 'VINTA se il giocatore segna almeno 1 gol OPPURE fornisce almeno 1 assist (ultimo passaggio decisivo prima del gol, dati OPTA).';
    if (/o\s*il?\s*suo\s*sostituto/i.test(prediction)) {
      info += ' Con "O IL SUO SOSTITUTO": vale anche per il sostituto diretto.';
    }
    info += ' Se non entra in campo: rimborsata. Autogol NON conta come gol segnato.';
    return info;
  }
  // Standard cartellino (non Plus)
  if (betType === 'Cartellino' && /o\s*suo\s*sostituto/i.test(prediction)) {
    return 'Cartellino con sostituto: vale anche il cartellino del sostituto diretto. Standard: solo cartellini a giocatori IN CAMPO (panchina/dopo fischio NON contano). Se non partecipa: rimborsata.';
  }
  return SETTLEMENT_RULES[betType] || '';
}

// ===== Rilevamento concessionario italiano =====
// Lista concessionari .it noti con licenza ADM
const CONCESSIONARI_IT = [
  { pattern: /sportium/i, name: 'Sportium.it', domain: 'sportium.it' },
  { pattern: /eplay\s*24/i, name: 'Eplay24.it', domain: 'eplay24.it' },
  { pattern: /betwin\s*360/i, name: 'Betwin360.it', domain: 'betwin360.it' },
  { pattern: /goldbet/i, name: 'Goldbet.it', domain: 'goldbet.it' },
  { pattern: /lottomatica|better\.it/i, name: 'Lottomatica.it', domain: 'lottomatica.it' },
  { pattern: /snai/i, name: 'SNAI.it', domain: 'snai.it' },
  { pattern: /sisal/i, name: 'Sisal.it', domain: 'sisal.it' },
  { pattern: /eurobet/i, name: 'Eurobet.it', domain: 'eurobet.it' },
  { pattern: /bet365/i, name: 'Bet365.it', domain: 'bet365.it' },
  { pattern: /william\s*hill/i, name: 'WilliamHill.it', domain: 'williamhill.it' },
  { pattern: /betflag/i, name: 'Betflag.it', domain: 'betflag.it' },
  { pattern: /betway/i, name: 'Betway.it', domain: 'betway.it' },
  { pattern: /888sport|888\.it/i, name: '888sport.it', domain: '888.it' },
  { pattern: /starcasino|star\s*casino/i, name: 'StarCasino.it', domain: 'starcasino.it' },
  { pattern: /bwin/i, name: 'Bwin.it', domain: 'bwin.it' },
  { pattern: /netbet/i, name: 'Netbet.it', domain: 'netbet.it' },
  { pattern: /leovegas/i, name: 'LeoVegas.it', domain: 'leovegas.it' },
  { pattern: /unibet/i, name: 'Unibet.it', domain: 'unibet.it' },
  { pattern: /vincitu|fivebet/i, name: 'Vincitu.it', domain: 'vincitu.it' },
  { pattern: /fantasyteam/i, name: 'FantasyTeam.it', domain: 'fantasyteam.it' },
  { pattern: /planetwin\s*365/i, name: 'Planetwin365.it', domain: 'planetwin365.it' },
  { pattern: /admiral\s*bet/i, name: 'AdmiralBet.it', domain: 'admiralbet.it' },
  { pattern: /stanleybet/i, name: 'Stanleybet.it', domain: 'stanleybet.it' },
];

function detectConcessionario(text) {
  for (const c of CONCESSIONARI_IT) {
    if (c.pattern.test(text)) {
      return c.name;
    }
  }
  return '';
}

// Verifica se il ticket è italiano: deve avere codice ADM/AAMS o concessionario .it riconosciuto
function isItalianTicket(text) {
  // Ha un codice AAMS/ADM?
  if (/\b(AAMS|ADM)\b/i.test(text)) return true;
  // Ha un concessionario .it riconosciuto?
  if (detectConcessionario(text)) return true;
  // Ha riferimenti italiani (concessione ADM, quota fissa, etc.)?
  if (/concessionar|quota\s*fissa|punto\s*vendita|ricevuta\s*di\s*partecipazione/i.test(text)) return true;
  // Ha un dominio .it nel testo?
  if (/\b\w+\.it\b/i.test(text)) return true;
  return false;
}

// ===== Estrazione codice AAMS/ADM =====
function extractTicketId(text) {
  const patterns = [
    /AAMS[:\s]*([A-Z0-9]{10,})/i,
    /ADM[:\s]*([A-Z0-9]{10,})/i,
    /codice\s*biglietto[:\s]*([A-Z0-9._-]{10,})/i,
    /codice[:\s]*([A-Z0-9]{10,})/i,
    /\bIB[-]([A-Z0-9]{2,4}[.][A-Z0-9]{4}[.][A-Z0-9]{4})/i,
    /\b([A-F0-9]{16,})\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// ===== Estrazione importi =====
function extractAmount(text, label) {
  // Cerca sia "label: 50,00 €" che "label: EUR 50,00" che "label: 50.00"
  const patterns = [
    new RegExp(label + '[:\\s]*(?:EUR\\s*)?([\\d.,]+)\\s*(?:€|eur)?', 'i'),
    new RegExp(label + '[:\\s]*€?\\s*([\\d.,]+)', 'i'),
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      return parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    }
  }
  return null;
}

function extractOdds(text) {
  const pattern = /quota\s*(?:totale)?[:\s]*([\d.,]+)/i;
  const m = text.match(pattern);
  if (m) {
    return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

// ===== Estrazione data giocata =====
function extractPlayedAt(text) {
  // "Giocata del: 19/03/2026 20:57" o "Giocata del 19/03/2026 20:57"
  const m = text.match(/giocata\s*del[:\s]*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*(\d{1,2})[:.]\s*(\d{2})/i);
  if (m) {
    const [, day, month, year, hour, min] = m;
    return new Date(year, month - 1, day, hour, min);
  }
  // "DATA: 21/03/2026  ORA: 14:35" (formato ADM)
  const m2 = text.match(/data[:\s]*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*ora[:\s]*(\d{1,2})[:.]\s*(\d{2})/i);
  if (m2) {
    const [, day, month, year, hour, min] = m2;
    return new Date(year, month - 1, day, hour, min);
  }
  return null;
}

// ===== Classificazione righe OCR =====

// Riga di intestazione evento: "19/03/2026 21:00 - Calcio - Europa League"
function parseEventHeader(line) {
  const m = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\s+(\d{1,2})[:.]\s*(\d{2})\s*[-–]\s*([A-Za-zÀ-ú\s]+?)\s*[-–]\s*(.+)$/i);
  if (m) {
    const [, day, month, year, hour, min, sport, competition] = m;
    const fullYear = year.length === 2 ? '20' + year : year;
    return {
      eventDate: new Date(fullYear, month - 1, day, hour, min),
      sport: sport.trim(),
      competition: competition.trim(),
    };
  }
  // Variante senza orario o con formato diverso
  const m2 = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}).*[-–]\s*([A-Za-zÀ-ú\s]+?)\s*[-–]\s*(.+)$/i);
  if (m2) {
    const [, day, month, year, sport, competition] = m2;
    const fullYear = year.length === 2 ? '20' + year : year;
    return {
      eventDate: new Date(fullYear, month - 1, day),
      sport: sport.trim(),
      competition: competition.trim(),
    };
  }
  return null;
}

// Riga di match: "Roma vs Bologna (3:3)" o "Aston Villa vs Lilla (2:0)"
function parseMatchLine(line) {
  // Pattern: Team1 vs Team2 con opzionale punteggio
  // Usa .+? per catturare nomi squadre con qualsiasi carattere
  const m = line.match(/^(.+?)\s+vs\.?\s+(.+?)(?:\s*\((\d+[:.]\d+)\))?\s*$/i);
  if (m && m[1].trim().length >= 2 && m[2].trim().length >= 2) {
    return {
      match: `${m[1].trim()} vs ${m[2].trim()}`,
      score: m[3] ? m[3].replace('.', ':') : '',
    };
  }
  // Pattern ADM: "ROMA - LAZIO" con separatore "-" o "–"
  // NON per date (inizia con numero) e NON per righe giocatore (contiene parentesi con squadra)
  if (!line.match(/^\d{1,2}[/.-]\d{1,2}/) && !line.match(/\([A-Za-zÀ-ú\s.]+\)\s*[:/O]/i)) {
    const m2 = line.match(/^([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.']+?)\s+[-–]\s+([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.']+?)(?:\s*\((\d+[:.]\d+)\))?\s*$/i);
    if (m2 && m2[1].trim().length >= 2 && m2[2].trim().length >= 2) {
      return {
        match: `${m2[1].trim()} vs ${m2[2].trim()}`,
        score: m2[3] ? m2[3].replace('.', ':') : '',
      };
    }
  }
  return null;
}

// Riga di scommessa: formati supportati:
// "CELIK, ZEKI (ROMA) O SUO SOSTITUTO CARTELLINO... SI 4.32"
// "U/O 1.5 SQUADRA 2 OVER 1.33"  (Sportium)
// "DOPPIA CHANCE IN + U/O 1.5 1X + OVER 1.31"  (combo)
// "PARZIALE/FINALE +U/O 1.5 1/1+OVER 1.51"
// "MULTIGOL 1-3 CASA SI 1.50"
function parseBetLine(line) {
  // Normalizza separatori OCR: "|" "©" "®" → spazio, pulisci "[" "]" isolati (artefatti OCR)
  let normalized = line.replace(/[|@©®]/g, ' ').replace(/\s*[\[\]]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // Fix OCR: "0VER" → "OVER", "S1" → "SI"
  normalized = normalized.replace(/\b0VER\b/g, 'OVER').replace(/\bUNDER\b/gi, 'UNDER');

  let odds;
  let selection = '';

  // Lista di tutte le selezioni valide (ordine: combo lunghe prima, semplici dopo)
  const SELECTION_TOKENS = [
    // Combo parziale+over/under
    /\d\/[1X2]\s*\+\s*(?:OVER|UNDER)/i,
    // Combo doppia chance+over/under
    /[1X2]{2}\s*\+\s*(?:OVER|UNDER)/i,
    // Combo singola+over/under
    /[1X2]\s*\+\s*(?:OVER|UNDER)/i,
    // Parziale/finale
    /[1X2]\/[1X2]/i,
    // NO GOAL (prima di GOAL e NO)
    /NO\s*GOAL/i,
    // Parole singole
    /OVER/i, /UNDER/i, /GOAL/i, /GG/i, /NG/i,
    /PARI/i, /DISPARI/i,
    /SI/i, /S[IÌ]/i, /NO/i,
    // Doppia chance
    /1X/i, /X2/i, /12/i,
    // 1X2 semplice (singolo carattere)
    /[1X2]/i,
  ];

  // Costruisci un unico pattern: cerca <selezione> <quota> alla fine (con eventuale testo dopo la quota)
  // Strategia: scansioniamo dalla fine della riga per trovare quota e selezione

  // 1. Cerca la quota (ultimo numero decimale nella riga)
  const oddsMatches = [...normalized.matchAll(/(\d+[.,]\d{1,2})/g)];
  const lastOddsMatch = oddsMatches.length > 0 ? oddsMatches[oddsMatches.length - 1] : null;

  if (lastOddsMatch) {
    const oddsValue = parseFloat(lastOddsMatch[1].replace(',', '.'));
    const oddsIdx = lastOddsMatch.index;
    const textBeforeOdds = normalized.substring(0, oddsIdx).trim();

    // 2. Cerca la selezione subito prima della quota
    for (const tokenRe of SELECTION_TOKENS) {
      // Costruisci pattern che matcha il token alla fine del testo prima della quota
      const fullRe = new RegExp('\\b(' + tokenRe.source + ')\\s*$', 'i');
      const selMatch = textBeforeOdds.match(fullRe);
      if (selMatch) {
        selection = selMatch[1].toUpperCase().replace('SÌ', 'SI').replace(/\s+/g, ' ').trim();
        odds = oddsValue;
        break;
      }
    }

    // Se non ha trovato selezione ma la quota è valida (>= 1.01), prendila comunque
    if (!selection && oddsValue >= 1.01) {
      odds = oddsValue;
    }
  }

  // Rimuovi selezione e quota dalla descrizione
  let description = normalized;
  if (selection && odds) {
    // Rimuovi da "SELEZIONE QUOTA" in poi (o fino alla fine)
    const escSel = selection.replace(/[+]/g, '\\+').replace(/\//g, '\\/');
    const removeRe = new RegExp('\\s*' + escSel + '\\s+\\d+[.,]\\d{1,2}.*$', 'i');
    description = description.replace(removeRe, '').trim();
  } else if (odds) {
    // Rimuovi solo la quota alla fine
    description = description.replace(/\s*\d+[.,]\d{1,2}\s*$/, '').trim();
  }

  // Post-processing: se la selezione non è stata estratta ma la descrizione finisce
  // con un pattern di selezione noto, estrailo ora
  if (!selection && description) {
    for (const tokenRe of SELECTION_TOKENS) {
      const postRe = new RegExp('\\s+(' + tokenRe.source + ')\\s*$', 'i');
      const pm = description.match(postRe);
      if (pm) {
        selection = pm[1].toUpperCase().replace('SÌ', 'SI').replace(/\s+/g, ' ').trim();
        description = description.substring(0, pm.index).trim();
        break;
      }
    }
  }

  // Pulizia residui
  description = description.replace(/\s+/g, ' ').trim();

  // Estrai nome giocatore: "COGNOME, NOME (SQUADRA)" o "COGNOME NOME (SQUADRA):"
  let player = '';
  const playerMatch = description.match(/^([A-ZÀ-Ú][A-ZÀ-Ú\s,.']+?)\s*\([A-Za-zÀ-ú\s.]+\)/);
  if (playerMatch) {
    player = playerMatch[1].trim().replace(/,\s*$/, '');
    // Formatta il nome: "CELIK, ZEKI" → "Celik, Zeki"
    player = player.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // Determina il tipo di scommessa dalla descrizione
  const betType = detectBetType(description);

  return {
    prediction: description,
    selection,
    player,
    betType,
    odds,
  };
}

// Determina se una riga è una riga di scommessa (non header, non match, non summary)
function isBetDescriptionLine(line) {
  // Non è una riga vuota
  if (!line.trim()) return false;
  // Non è una riga di intestazione evento (inizia con data)
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(line)) return false;
  // Non è una riga di match
  if (parseMatchLine(line)) return false;
  // Non è una riga di riepilogo o metadati ticket
  if (/^(quota|importo|vincita|puntata|giocata\s*del|giocata\s*$|aams|adm|codice|data[:\s]|ora[:\s]|bonus|ib[-]|cc[-]|nc[-]|pv[-]|pal[:\s]|avv[:\s]|singola|multipla|sistema|totale\s*importo|importo\s*scommesso|concession|punto\s*vendita|ricevuta|stato[:\s]|quota\s*totale|stampa|condividi|cashout|venduto|vincita\s*potenziale|importo\s*bonus)/i.test(line.trim())) return false;
  // Non è un barcode o codice operatore
  if (/^[A-Z]{2,3}[-]\d/i.test(line.trim())) return false;
  // Non è troppo corta (probabilmente rumore OCR)
  if (line.trim().length < 5) return false;
  // Deve contenere lettere (non solo numeri/simboli)
  if (!/[A-Za-zÀ-ú]{2,}/.test(line)) return false;
  return true;
}

// ===== Rilevamento inizio nuova scommessa =====
// Una nuova scommessa inizia quando la riga contiene un pattern "COGNOME, NOME (SQUADRA)"
// che indica l'inizio di una giocata su un giocatore
function startsNewBet(line) {
  // Pattern giocatore: "COGNOME, NOME (SQUADRA)" all'inizio della riga
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s,.']+\s*\([A-Za-zÀ-ú\s.]+\)/i.test(line)) return true;
  // Pattern con ":" dopo la parentesi: "MALEN, DONYELL (ROMA): SEGNA O..."
  if (/^[A-ZÀ-Ú][A-ZÀ-Ú\s,.']+\s*\([A-Za-zÀ-ú\s.]+\)\s*:/i.test(line)) return true;
  // Pattern scommessa non-giocatore (1X2, Under/Over, Multigol, Combo, etc.)
  if (/^(1X2|UNDER|OVER|U\/O|GOAL|NO\s*GOAL|GG|NG|DOPPIA\s*CHANCE|HANDICAP|RIS\.?\s*ES|PARI|DISPARI|MULTIGOL|PARZIALE|COMBO|SEGNA\s*GOL|VINCE\s*A\s*ZERO|SOMMA\s*GOAL|CORNER|ANGOLI|CARTELLINI|ESPULSIONE|AUTORETE|RIGORE|RIBALTONE)/i.test(line)) return true;
  return false;
}

// ===== Pre-elaborazione testo incollato =====
// Unisce righe separate Team1/vs/Team2 e pulisce rumore Sportium
function preprocessPastedText(text) {
  let lines = text.split('\n');

  // Fase 1: Unisci "Team1 \n vs \n Team2" in una sola riga
  const merged = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Se la riga è "vs" o "vs." da sola, unisci con la riga precedente e successiva
    if (/^\s*vs\.?\s*$/i.test(trimmed) && merged.length > 0 && i + 1 < lines.length) {
      const team1 = merged.pop();
      const team2 = lines[i + 1].trim();
      merged.push(team1 + ' vs ' + team2);
      i++; // Salta la riga team2
    } else {
      merged.push(trimmed);
    }
  }

  // Fase 2: Filtra righe di rumore (metadata, UI elements)
  const NOISE_RE = /^\s*(stato\s*:\s*\w+|giocata\s*$|venduto|stampa|condividi\s*cashout|condividicashout|stampa\s*condividi\s*cashout|stampacondividicashout|condividi|cashout|importo\s*bonus|vincita\s*potenziale|giocata\s*del\s*:)/i;
  const filtered = merged.filter((l) => {
    if (!l.trim()) return false;
    if (NOISE_RE.test(l.trim())) return false;
    return true;
  });

  return filtered.join('\n');
}

// ===== Parser principale scommesse =====
function parseBets(text) {
  // Pre-elabora il testo: unisci Team/vs/Team, rimuovi rumore
  text = preprocessPastedText(text);

  const lines = text.split('\n').filter((l) => l.trim());
  const bets = [];

  // Stato corrente durante il parsing
  let currentHeader = null; // { eventDate, sport, competition }
  let currentMatch = null;  // { match, score }

  // Accumula righe di scommessa fino a trovare un nuovo inizio
  let pendingBetLines = [];

  // Pattern riutilizzati
  const SELECTION_RE = /^\s*(SI|NO|S[IÌ]|OVER|UNDER|GOAL|NO\s*GOAL|GG|NG|PARI|DISPARI|[1X2]{1,2}(?:\s*\+\s*(?:OVER|UNDER))?|\d\/[1X2](?:\s*\+\s*(?:OVER|UNDER))?)\s*$/i;
  const SELECTION_ODDS_RE = /^\s*(SI|NO|S[IÌ]|OVER|UNDER|GOAL|NO\s*GOAL|GG|NG|PARI|DISPARI|[1X2]{1,2}(?:\s*\+\s*(?:OVER|UNDER))?|\d\/[1X2](?:\s*\+\s*(?:OVER|UNDER))?)\s*[|]?\s*(\d+[.,]\d{1,2})\s*$/i;
  const ODDS_ONLY_RE = /^\s*(\d+[.,]\d{1,2})\s*$/;
  const BET_LABEL_RE = /^\s*(cartellino|marcatore|risultato|ammonizione|espulsione|autogol|autorete|rigore|corner|tiri|assist|fallo|fuorigioco|parata|gol)\s*$/i;
  // Tipo scommessa Sportium: "ESITO FINALE 1X2", "GOAL/NO GOAL", "UNDER/OVER 2,5", etc.
  const BET_TYPE_LINE_RE = /^\s*(ESITO\s+FINALE\s+1X2|GOAL\s*\/\s*NO\s*GOAL|UNDER\s*\/\s*OVER\s*[\d.,]*|DOPPIA\s+CHANCE|PARZIALE\s*\/?\s*FINALE|HANDICAP|MULTIGOL|COMBO\s+\w+|SOMMA\s+GOAL|MARCATORE|RIGORE|ESPULSIONE|CARTELLINI|AUTORETE|CORNER|ANGOLI|RISULTATO\s+ESATTO|PRIMO\s+TEMPO|SECONDO\s+TEMPO|SEGNA\s*GOL|VINCE\s*A\s*ZERO|DC\s*\/?\s*GNG|COMBO\s+SCOMMESSA|GOAL\/NO\s*GOAL)\s*$/i;

  const flushPendingBet = () => {
    if (pendingBetLines.length === 0) return;
    const fullLine = pendingBetLines.join(' ');
    const finalBet = parseBetLine(fullLine);

    bets.push({
      match: currentMatch ? currentMatch.match : 'Scommessa',
      sport: currentHeader ? currentHeader.sport : '',
      competition: currentHeader ? currentHeader.competition : '',
      prediction: finalBet.prediction,
      selection: finalBet.selection,
      betType: finalBet.betType,
      player: finalBet.player,
      odds: finalBet.odds,
      eventDate: currentHeader ? currentHeader.eventDate : new Date(),
      score: currentMatch ? currentMatch.score : '',
      settlementInfo: getSettlementInfo(finalBet.betType, finalBet.prediction),
    });
    pendingBetLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1. Controlla se è una riga di intestazione evento
    const header = parseEventHeader(line);
    if (header) {
      flushPendingBet();
      currentHeader = header;
      continue;
    }

    // 2. Controlla se è una riga di match (es: "Parma vs Cremonese")
    const matchInfo = parseMatchLine(line);
    if (matchInfo) {
      flushPendingBet();
      currentMatch = matchInfo;
      continue;
    }

    // 3. Ordine di priorità per classificare la riga:

    // a) Etichette singole tipo scommessa (Cartellino, Marcatore) → ignora
    if (BET_LABEL_RE.test(line)) {
      continue;
    }

    // b) Tipo scommessa Sportium su riga separata (ESITO FINALE 1X2, GOAL/NO GOAL)
    //    → è la descrizione della scommessa, inizia un nuovo bet
    if (BET_TYPE_LINE_RE.test(line)) {
      flushPendingBet();
      pendingBetLines.push(line);
      continue;
    }

    // c) Selezione + Quota (es: "SI 2.05", "GOAL 2.12") → aggiungi al pending
    if (pendingBetLines.length > 0 && SELECTION_ODDS_RE.test(line)) {
      pendingBetLines.push(line.replace(/[|]/g, ' '));
      continue;
    }

    // d) Solo selezione (es: "1", "GOAL", "SI") → aggiungi al pending
    if (pendingBetLines.length > 0 && SELECTION_RE.test(line)) {
      pendingBetLines.push(line);
      continue;
    }

    // e) Solo quota (es: "2.18") → aggiungi al pending
    if (pendingBetLines.length > 0 && ODDS_ONLY_RE.test(line)) {
      pendingBetLines.push(line);
      continue;
    }

    // f) Riga di descrizione scommessa
    if (isBetDescriptionLine(line)) {
      if (startsNewBet(line)) {
        flushPendingBet();
      }
      pendingBetLines.push(line);
      continue;
    }

    // g) Altro → flush pending
    flushPendingBet();
  }
  // Flush l'ultima scommessa pendente
  flushPendingBet();

  // Fallback: se non trova nessuna scommessa strutturata
  if (bets.length === 0) {
    const vsMatch = text.match(/([A-Za-zÀ-ú][A-Za-zÀ-ú\s.']+?)\s+vs\.?\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s.']+)/i);
    const matchName = vsMatch ? `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}` : 'Scommessa caricata';

    const meaningfulLines = lines.filter((l) => {
      const t = l.trim();
      return t.length > 10 &&
        !/^\d{1,2}[/.-]/.test(t) &&
        !/^(quota|importo|vincita|giocata|aams|adm)/i.test(t);
    });

    bets.push({
      match: matchName,
      prediction: meaningfulLines[0]?.trim() || 'Da verificare manualmente',
      betType: detectBetType(text),
      eventDate: new Date(),
    });
  }

  return bets;
}

// ===== Stato chiusi da rifiutare =====
const CLOSED_STATUSES = [
  'da non pagare',
  'non pagare',
  'perdente',
  'persa',
  'rimborsata',
  'rimborsabile',
  'annullata',
  'annullato',
  'void',
];

function isTicketClosed(text) {
  const lower = text.toLowerCase();
  return CLOSED_STATUSES.some((s) => lower.includes(s));
}

// ===== ROUTES =====

// Upload ticket con OCR
router.post('/upload', auth, upload.single('ticket'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nessuna immagine caricata.' });
    }

    console.log('File ricevuto in memoria, size:', req.file.size);

    let text = '';
    let bets = [];

    try {
      const result = await Tesseract.recognize(req.file.buffer, 'ita+eng');
      text = result.data.text;
      console.log('OCR completato. Testo estratto:', text.substring(0, 300));
      bets = parseBets(text);
    } catch (ocrErr) {
      console.error('Errore OCR:', ocrErr.message);
      text = 'OCR non disponibile';
      bets = [{ match: 'Scommessa caricata', prediction: 'Da verificare manualmente', betType: 'N/D', eventDate: new Date() }];
    }

    // Verifica che sia un ticket italiano (.it / ADM)
    if (text !== 'OCR non disponibile' && !isItalianTicket(text)) {
      return res.status(400).json({
        message: 'Questo ticket non sembra provenire da un concessionario italiano con licenza ADM. Sono accettati solo ticket di siti .it autorizzati.',
      });
    }

    // Rileva concessionario
    const concessionario = detectConcessionario(text);
    console.log('Concessionario rilevato:', concessionario || '(non riconosciuto)');

    // Rifiuta ticket già chiusi/persi
    if (isTicketClosed(text)) {
      return res.status(400).json({
        message: 'Questo ticket risulta già chiuso. Puoi caricare solo ticket ancora in corso.',
      });
    }

    // Estrai ID ticket AAMS/ADM
    const ticketId = extractTicketId(text);
    console.log('Ticket ID estratto:', ticketId);

    // Controlla duplicati: se lo stesso ticketId è già stato caricato (da qualsiasi utente)
    if (ticketId) {
      const existing = await Ticket.findOne({ ticketId });
      if (existing) {
        return res.status(400).json({
          message: `Questo ticket è già stato caricato (ID: ${ticketId}). Non è possibile caricare lo stesso ticket due volte.`,
        });
      }
    }

    // Estrai importi, quota e data giocata
    let stake = extractAmount(text, 'importo\\s*(?:pagato|giocato|scommesso)');
    if (!stake) stake = extractAmount(text, 'totale\\s*importo\\s*scommesso');
    if (!stake) stake = extractAmount(text, 'puntata');
    if (!stake) stake = extractAmount(text, 'importo');
    // Cerca prima "vincita potenziale", poi "vincita" generica
    let potentialWin = extractAmount(text, 'vincita\\s*potenziale');
    if (!potentialWin) {
      potentialWin = extractAmount(text, 'vincita');
    }
    const totalOdds = extractOdds(text);
    const playedAt = extractPlayedAt(text);

    const ticket = new Ticket({
      user: req.user._id,
      ticketId,
      concessionario,
      ocrRawText: text,
      bets,
      stake,
      potentialWin,
      totalOdds,
      playedAt,
    });

    await ticket.save();

    res.status(201).json({
      message: 'Ticket caricato e analizzato!',
      ticket,
    });
  } catch (err) {
    console.error('Errore upload ticket:', err);
    // Gestisci errore duplicato MongoDB
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Questo ticket è già stato caricato. Non è possibile caricare lo stesso ticket due volte.',
      });
    }
    res.status(500).json({ message: 'Errore durante il caricamento.', error: err.message });
  }
});

// ===== Import ticket da link Sportium =====
// Fetcha la pagina HTML del ticket condiviso e ne estrae i dati strutturati
async function parseSportiumHtml(html, url) {
  const bets = [];
  let stake = null;
  let potentialWin = null;
  let totalOdds = null;
  let ticketId = null;
  let playedAt = null;

  // Estrai ticketId dall'URL: /ticket/<ID>
  const urlIdMatch = url.match(/\/ticket\/([A-Z0-9]+)/i);
  if (urlIdMatch) ticketId = urlIdMatch[1].toUpperCase();

  // Rimuovi HTML tags ma conserva la struttura (newlines per blocchi)
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/span>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/&#\d+;/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  console.log('Sportium HTML parsed text (first 500):', text.substring(0, 500));

  // Cerca AAMS/ticketId nel testo
  if (!ticketId) {
    const aamsMatch = text.match(/AAMS[:\s]*([A-Z0-9]{10,})/i);
    if (aamsMatch) ticketId = aamsMatch[1].toUpperCase();
  }

  // Estrai importi
  const stakeMatch = text.match(/[Ii]mporto\s*(?:pagato|scommesso)[:\s]*([0-9.,]+)\s*€?/);
  if (stakeMatch) stake = parseFloat(stakeMatch[1].replace(',', '.'));
  const winMatch = text.match(/[Vv]incita\s*(?:potenziale)?[:\s]*([0-9.,]+)\s*€?/);
  if (winMatch) potentialWin = parseFloat(winMatch[1].replace(',', '.'));
  const totalOddsMatch = text.match(/[Qq]uota\s*(?:totale)?[:\s]*([0-9.,]+)/);
  if (totalOddsMatch) totalOdds = parseFloat(totalOddsMatch[1].replace(',', '.'));
  const playedAtMatch = text.match(/[Gg]iocata\s*del[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(\d{1,2}[:.]\d{2})?/);
  if (playedAtMatch) {
    const [, dateStr, timeStr] = playedAtMatch;
    const [d, m, y] = dateStr.split('/');
    const fullY = y.length === 2 ? '20' + y : y;
    if (timeStr) {
      const [h, min] = timeStr.split(/[:.]/);
      playedAt = new Date(fullY, m - 1, d, h, min);
    } else {
      playedAt = new Date(fullY, m - 1, d);
    }
  }

  // Parsa come testo strutturato usando il parser principale
  const parsedBets = parseBets(text);
  if (parsedBets.length > 0) {
    // Calcola totalOdds/potentialWin se non estratti dall'HTML
    if (!totalOdds && parsedBets.length > 0) {
      const computedOdds = parsedBets.reduce((acc, b) => b.odds ? acc * b.odds : acc, 1);
      if (computedOdds > 1) totalOdds = Math.round(computedOdds * 100) / 100;
    }
    if (!potentialWin && stake && totalOdds) {
      potentialWin = Math.round(stake * totalOdds * 100) / 100;
    }
    return { bets: parsedBets, stake, potentialWin, totalOdds, ticketId, playedAt };
  }

  return { bets: [{ match: 'Ticket da link', prediction: 'Da verificare manualmente', betType: 'N/D', eventDate: new Date() }], stake, potentialWin, totalOdds, ticketId, playedAt };
}

// Fetch con curl (TLS fingerprint diverso da Node.js, bypassa molti WAF)
function fetchWithCurl(url) {
  // Prova più profili User-Agent per aggirare blocchi
  const profiles = [
    {
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1',
      secFetch: false,
    },
    {
      ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      secFetch: true,
    },
    {
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      secFetch: true,
    },
  ];

  for (const profile of profiles) {
    try {
      // Costruisci headers dinamici
      const domain = url.match(/https?:\/\/([^/]+)/i)?.[1] || '';
      let headers = `\
        -H "User-Agent: ${profile.ua}" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" \
        -H "Accept-Language: it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7" \
        -H "Accept-Encoding: gzip, deflate, br" \
        -H "Connection: keep-alive" \
        -H "Upgrade-Insecure-Requests: 1" \
        -H "Cache-Control: max-age=0" \
        -H "Referer: https://${domain}/"`;

      if (profile.secFetch) {
        headers += ` \
        -H "Sec-Fetch-Dest: document" \
        -H "Sec-Fetch-Mode: navigate" \
        -H "Sec-Fetch-Site: same-origin" \
        -H "Sec-Fetch-User: ?1" \
        -H "sec-ch-ua: \\"Chromium\\";v=\\"131\\", \\"Not_A Brand\\";v=\\"24\\"" \
        -H "sec-ch-ua-mobile: ?0" \
        -H "sec-ch-ua-platform: \\"Windows\\""`;
      }

      const html = execSync(
        `curl -s -L --max-time 25 --compressed -b "" -c /dev/null ${headers} "${url}"`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );
      const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      if (text.length > 100 && !text.includes('Access Denied') && !text.includes('403 Forbidden') && !text.includes('Cloudflare')) {
        console.log(`[fetchWithCurl] OK con profilo ${profile.ua.substring(0, 30)}..., ${text.length} char`);
        return { html, text };
      }
      console.log(`[fetchWithCurl] Profilo bloccato, provo il prossimo...`);
    } catch (e) {
      console.error('[fetchWithCurl] Errore profilo:', e.message?.substring(0, 100));
    }
  }
  return null;
}

// Fallback: Puppeteer (browser headless) con stealth avanzato
async function fetchWithBrowser(url) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--window-size=412,915',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=it-IT,it',
      '--enable-features=NetworkService,NetworkServiceInProcess',
    ],
  });

  try {
    const page = await browser.newPage();

    // Abilita JavaScript, DOM Storage e Cookie (fondamentale per Cloudflare)
    await page.setJavaScriptEnabled(true);
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    // Abilita DOM Storage esplicitamente via CDP
    await client.send('DOMStorage.enable');

    // Simula dispositivo mobile reale (link condivisi Sportium sono mobile)
    await page.setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    );
    await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 2.625 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Anti-detection avanzato — nasconde ogni traccia di automazione
    await page.evaluateOnNewDocument(() => {
      // Nasconde webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Lingua e piattaforma realistiche
      Object.defineProperty(navigator, 'languages', { get: () => ['it-IT', 'it', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv81' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
      // Chrome runtime (necessario per passare i check)
      window.chrome = {
        runtime: { onConnect: {}, onMessage: {}, sendMessage: () => {} },
        loadTimes: () => ({ commitLoadTime: Date.now() / 1000 }),
        csi: () => ({ startE: Date.now(), onloadT: Date.now() }),
      };
      // Plugin finti (un browser vero ne ha sempre)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ],
      });
      // Permissions
      const originalQuery = window.navigator.permissions?.query;
      if (originalQuery) {
        window.navigator.permissions.query = (params) =>
          params.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(params);
      }
      // WebGL vendor spoofing
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Google Inc. (Qualcomm)';
        if (param === 37446) return 'ANGLE (Qualcomm, Adreno (TM) 750, OpenGL ES 3.2)';
        return getParameter.call(this, param);
      };
    });

    // 1. Prima navigazione — potrebbe finire sulla challenge Cloudflare
    console.log('[fetchWithBrowser] Navigazione iniziale...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 2. Controlla se siamo su una challenge Cloudflare e aspetta che si risolva
    const maxWaitCF = 30000; // max 30 secondi per la challenge
    const startCF = Date.now();
    let passedChallenge = false;

    while (Date.now() - startCF < maxWaitCF) {
      const pageText = await page.evaluate(() => document.body?.innerText || '');
      const pageTitle = await page.evaluate(() => document.title || '');

      const isChallenging = pageText.includes('Just a moment') ||
        pageText.includes('Checking your browser') ||
        pageText.includes('Verifica del browser') ||
        pageText.includes('Attention Required') ||
        pageText.includes('Please Wait') ||
        pageTitle.includes('Just a moment') ||
        pageText.length < 100;

      if (!isChallenging) {
        console.log(`[fetchWithBrowser] Challenge Cloudflare superata in ${Date.now() - startCF}ms`);
        passedChallenge = true;
        break;
      }

      console.log(`[fetchWithBrowser] Challenge Cloudflare in corso... (${Math.round((Date.now() - startCF) / 1000)}s)`);
      // Attendi un po' tra i check — ritardo randomizzato per sembrare umano
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    }

    if (!passedChallenge) {
      console.log('[fetchWithBrowser] Challenge Cloudflare NON superata dopo 30s');
    }

    // 3. Aspetta che la rete si stabilizzi dopo la challenge
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      // Potrebbe non esserci una navigazione aggiuntiva, va bene
    }

    // 4. Aspetta il contenuto del ticket (SPA: il contenuto potrebbe caricarsi via JS)
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText;
          return text.length > 300 && (
            /\bvs\.?\b/i.test(text) ||
            /quota/i.test(text) ||
            /scommess/i.test(text) ||
            /importo/i.test(text) ||
            /AAMS/i.test(text) ||
            /vincita/i.test(text) ||
            /giocata/i.test(text)
          );
        },
        { timeout: 15000 }
      );
      console.log('[fetchWithBrowser] Contenuto ticket rilevato!');
    } catch (e) {
      console.log('[fetchWithBrowser] Timeout attesa contenuto ticket, provo comunque...');
      // Attesa extra con scroll per lazy loading
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 5. Scrolla per triggerare lazy content
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight / 2);
      await new Promise(r => setTimeout(r, 500));
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1500));

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);

    console.log(`[fetchWithBrowser] Pagina caricata, ${text.length} char di testo`);
    console.log(`[fetchWithBrowser] Primi 300 char: ${text.substring(0, 300)}`);
    return { html, text };
  } finally {
    await browser.close();
  }
}

// Import ticket da URL (link condivisione Sportium o altri)
router.post('/import-url', auth, async (req, res) => {
  try {
    const { url, clientHtml } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'Inserisci un link valido.' });
    }

    // Valida che sia un URL di un concessionario .it
    const urlDomain = url.match(/https?:\/\/([^/]+)/i);
    if (!urlDomain || !urlDomain[1].endsWith('.it')) {
      return res.status(400).json({
        message: 'Sono accettati solo link di concessionari italiani (.it).',
      });
    }

    // Estrai ticket ID dall'URL per controllo duplicati
    const urlTicketId = url.match(/\/ticket\/([A-Z0-9]+)/i);
    if (urlTicketId) {
      const existing = await Ticket.findOne({ ticketId: urlTicketId[1].toUpperCase() });
      if (existing) {
        return res.status(400).json({
          message: `Questo ticket è già stato caricato (ID: ${urlTicketId[1]}). Non è possibile caricare lo stesso ticket due volte.`,
        });
      }
    }

    let html, text;

    // Se il client ha già fornito l'HTML (fetch lato client), usalo direttamente
    if (clientHtml && clientHtml.length > 100) {
      console.log(`[Import URL] Usando HTML fornito dal client (${clientHtml.length} caratteri)`);
      html = clientHtml;
      text = clientHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    } else {
      // Strategia 1: curl (TLS fingerprint diverso, bypassa molti WAF)
      console.log(`[Import URL] Tentativo con curl: ${url}`);
      const curlResult = fetchWithCurl(url);
      if (curlResult && curlResult.html && !curlResult.text.includes('Access Denied') && curlResult.text.length > 100) {
        console.log(`[Import URL] curl OK, ${curlResult.text.length} caratteri`);
        html = curlResult.html;
        text = curlResult.text;
      } else {
        // Strategia 2: Puppeteer con stealth
        console.log(`[Import URL] curl bloccato, provo Puppeteer headless...`);
        try {
          const result = await fetchWithBrowser(url);
          html = result.html;
          text = result.text;
        } catch (browserErr) {
          console.error('Errore Puppeteer:', browserErr.message);
          return res.status(500).json({
            message: `Errore nell'apertura del link: ${browserErr.message}. Verifica che il link sia corretto e riprova.`,
          });
        }
      }

      // Se tutto è bloccato (controlla vari messaggi di blocco)
      const blockPatterns = ['Access Denied', '403 Forbidden', 'Cloudflare', 'Just a moment', 'Checking your browser', 'Attention Required', 'Please Wait', 'Bot detected', 'captcha'];
      const isBlocked = text && (text.length < 100 || blockPatterns.some(p => text.includes(p)));
      if (isBlocked) {
        console.log('[Import URL] Tutti i metodi bloccati, richiedo fetch lato client');
        return res.status(403).json({
          message: 'Il sito ha bloccato la richiesta. Usa la funzione "Incolla testo" per importare manualmente.',
          needsClientFetch: true,
        });
      }
    }

    if (!html || (!text || text.trim().length < 50)) {
      return res.status(400).json({
        message: 'La pagina non contiene dati del ticket. Verifica che il link sia corretto.',
      });
    }

    console.log(`[Import URL] Pagina caricata, testo estratto: ${text.length} caratteri`);

    // Rileva concessionario dall'URL
    const concessionario = detectConcessionario(url);

    // Parse HTML/testo
    const parsed = await parseSportiumHtml(html, url);

    // Se il parser HTML non ha trovato scommesse, prova con il testo visibile
    if (!parsed.bets || parsed.bets.length === 0 ||
        (parsed.bets.length === 1 && parsed.bets[0].match === 'Ticket da link')) {
      // Prova a parsare il testo visibile come se fosse OCR
      const textParsed = await parseSportiumHtml(`<body>${text}</body>`, url);
      if (textParsed.bets && textParsed.bets.length > 0 &&
          !(textParsed.bets.length === 1 && textParsed.bets[0].match === 'Ticket da link')) {
        Object.assign(parsed, textParsed);
      }
    }

    const ticket = new Ticket({
      user: req.user._id,
      ticketId: parsed.ticketId,
      concessionario,
      ocrRawText: text.substring(0, 50000),
      bets: parsed.bets,
      stake: parsed.stake,
      potentialWin: parsed.potentialWin,
      totalOdds: parsed.totalOdds,
      playedAt: parsed.playedAt,
    });

    await ticket.save();

    res.status(201).json({
      message: 'Ticket importato dal link con successo!',
      ticket,
    });
  } catch (err) {
    console.error('Errore import URL:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Questo ticket è già stato caricato.',
      });
    }
    res.status(500).json({ message: 'Errore durante l\'importazione.', error: err.message });
  }
});

// Import ticket da testo incollato (alternativa quando il link non funziona)
router.post('/import-text', auth, async (req, res) => {
  try {
    const { text, sourceUrl } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ message: 'Incolla il testo completo del ticket.' });
    }

    // Verifica che sia italiano
    if (!isItalianTicket(text)) {
      return res.status(400).json({
        message: 'Il testo non sembra provenire da un concessionario italiano con licenza ADM.',
      });
    }

    const ticketId = extractTicketId(text) || (sourceUrl && sourceUrl.match(/\/ticket\/([A-Z0-9]+)/i)?.[1]?.toUpperCase());

    // Controlla duplicati
    if (ticketId) {
      const existing = await Ticket.findOne({ ticketId });
      if (existing) {
        return res.status(400).json({
          message: `Questo ticket è già stato caricato (ID: ${ticketId}).`,
        });
      }
    }

    const concessionario = detectConcessionario(text) || (sourceUrl ? detectConcessionario(sourceUrl) : '');
    const bets = parseBets(text);

    let stake = extractAmount(text, 'importo\\s*(?:pagato|giocato|scommesso)');
    if (!stake) stake = extractAmount(text, 'totale\\s*importo\\s*scommesso');
    if (!stake) stake = extractAmount(text, 'puntata');
    if (!stake) stake = extractAmount(text, 'importo');
    let potentialWin = extractAmount(text, 'vincita\\s*potenziale');
    if (!potentialWin) potentialWin = extractAmount(text, 'vincita');
    const totalOdds = extractOdds(text);
    const playedAt = extractPlayedAt(text);

    const ticket = new Ticket({
      user: req.user._id,
      ticketId,
      concessionario,
      ocrRawText: text,
      bets,
      stake,
      potentialWin,
      totalOdds,
      playedAt,
    });

    await ticket.save();

    res.status(201).json({
      message: 'Ticket importato dal testo con successo!',
      ticket,
    });
  } catch (err) {
    console.error('Errore import testo:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Questo ticket è già stato caricato.' });
    }
    res.status(500).json({ message: 'Errore durante l\'importazione.', error: err.message });
  }
});

// I miei ticket
router.get('/my', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Condividi/nascondi un ticket
router.patch('/:id/share', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket non trovato.' });
    }
    if (ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non puoi condividere ticket di altri.' });
    }
    ticket.shared = !ticket.shared;
    await ticket.save();
    res.json({ message: ticket.shared ? 'Ticket condiviso!' : 'Ticket nascosto.', ticket });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Re-parse un ticket dal testo OCR originale (riapplica il parser aggiornato)
router.patch('/:id/reparse', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket non trovato.' });
    if (ticket.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Non autorizzato.' });
    }
    if (!ticket.ocrRawText) {
      return res.status(400).json({ message: 'Testo OCR originale non disponibile.' });
    }
    const bets = parseBets(ticket.ocrRawText);
    ticket.bets = bets.map((b) => ({
      match: b.match,
      sport: b.sport || '',
      competition: b.competition || '',
      prediction: b.prediction,
      selection: b.selection || '',
      betType: b.betType || 'N/D',
      player: b.player || '',
      odds: b.odds,
      eventDate: b.eventDate,
      score: b.score || '',
      settlementInfo: b.settlementInfo || '',
    }));
    await ticket.save();
    res.json({ message: 'Ticket ri-analizzato con successo!', ticket });
  } catch (err) {
    console.error('Errore reparse:', err);
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Ticket condivisi da tutti i player (feed pubblico)
router.get('/shared', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ shared: true })
      .populate('user', 'alias avatar points')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Bacheca: elenco utenti che hanno condiviso almeno un ticket
router.get('/bacheca/users', auth, async (req, res) => {
  try {
    const users = await Ticket.aggregate([
      { $match: { shared: true } },
      { $group: { _id: '$user', ticketCount: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
      { $unwind: '$userInfo' },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          alias: '$userInfo.alias',
          avatar: '$userInfo.avatar',
          points: '$userInfo.points',
          ticketCount: 1,
        },
      },
      { $sort: { ticketCount: -1 } },
    ]);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Bacheca: ticket condivisi di un utente specifico (senza importo, vincita, ID)
router.get('/bacheca/user/:userId', auth, async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.params.userId, shared: true })
      .populate('user', 'alias avatar points')
      .sort({ createdAt: -1 })
      .select('-stake -potentialWin -ticketId -ocrRawText');
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Tutti i ticket (admin)
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso riservato.' });
    }
    const tickets = await Ticket.find().populate('user', 'email phone alias').sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Admin: aggiorna ticket (bets, stake, potentialWin, totalOdds, status)
router.patch('/:id/edit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso riservato.' });
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket non trovato.' });
    }

    const { bets, stake, potentialWin, totalOdds, status } = req.body;
    if (bets !== undefined) ticket.bets = bets;
    if (stake !== undefined) ticket.stake = stake;
    if (potentialWin !== undefined) ticket.potentialWin = potentialWin;
    if (totalOdds !== undefined) ticket.totalOdds = totalOdds;
    if (status && ['pending', 'won', 'lost'].includes(status)) {
      const previousStatus = ticket.status;
      ticket.status = status;
      const User = require('../models/User');
      if (status === 'won' && previousStatus !== 'won') {
        await User.findByIdAndUpdate(ticket.user, { $inc: { points: 1 } });
      } else if (previousStatus === 'won' && status !== 'won') {
        await User.findByIdAndUpdate(ticket.user, { $inc: { points: -1 } });
      }
    }

    await ticket.save();
    const updated = await Ticket.findById(ticket._id).populate('user', 'email phone alias');
    res.json({ message: 'Ticket aggiornato.', ticket: updated });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Aggiorna stato ticket (admin - refertazione)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso riservato.' });
    }
    const { status } = req.body;
    if (!['pending', 'won', 'lost'].includes(status)) {
      return res.status(400).json({ message: 'Stato non valido.' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket non trovato.' });
    }

    const previousStatus = ticket.status;
    ticket.status = status;
    await ticket.save();

    // Aggiorna punti utente
    const User = require('../models/User');
    if (status === 'won' && previousStatus !== 'won') {
      await User.findByIdAndUpdate(ticket.user, { $inc: { points: 1 } });
    } else if (previousStatus === 'won' && status !== 'won') {
      await User.findByIdAndUpdate(ticket.user, { $inc: { points: -1 } });
    }

    res.json({ message: 'Stato aggiornato.', ticket });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Elimina ticket (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso riservato.' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket non trovato.' });
    }

    // Se era vinto, togli il punto
    if (ticket.status === 'won') {
      const User = require('../models/User');
      await User.findByIdAndUpdate(ticket.user, { $inc: { points: -1 } });
    }

    await Ticket.findByIdAndDelete(req.params.id);

    res.json({ message: 'Ticket eliminato.' });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

module.exports = router;
