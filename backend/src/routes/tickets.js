const express = require('express');
const multer = require('multer');
const path = require('path');
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
  // Fix OCR: "0VER" → "OVER", "UNDER" con typo, "S1" → "SI" (1 letto come I)
  normalized = normalized.replace(/\b0VER\b/g, 'OVER').replace(/\bUNDER\b/gi, 'UNDER');

  let odds;
  let selection = '';

  // Strategia: cerchiamo la quota (numero decimale tipicamente 1.xx-99.xx) e il testo immediatamente prima.
  // La selezione è il blocco di testo che precede la quota e non fa parte della descrizione scommessa.

  // Pattern selezioni possibili (ordine di priorità):
  // Combo: "1X + OVER", "X2 + UNDER", "1 + OVER", "1X+OVER"
  // Parziale: "1/1+OVER", "1/X+OVER", "X/2+UNDER", "1/1", "X/2"
  // Semplici: "OVER", "UNDER", "SI", "NO", "SÌ", "GOAL", "NO GOAL", "GG", "NG", "PARI", "DISPARI"
  // 1X2: "1", "X", "2", "1X", "X2", "12"

  // Cerca: <selezione> <quota> alla fine della riga o seguita da testo post-quota (es. "FISCHIO FINALE")
  const selectionPatterns = [
    // Combo parziale+over: "1/1+OVER", "X/2+UNDER", etc.
    /\b(\d\/[1X2]\s*\+\s*OVER)\s+(\d+[.,]\d{1,2})\b/i,
    /\b(\d\/[1X2]\s*\+\s*UNDER)\s+(\d+[.,]\d{1,2})\b/i,
    // Combo doppia chance+over: "1X + OVER", "X2 + OVER", "12 + OVER"
    /\b([1X2]{2}\s*\+\s*OVER)\s+(\d+[.,]\d{1,2})\b/i,
    /\b([1X2]{2}\s*\+\s*UNDER)\s+(\d+[.,]\d{1,2})\b/i,
    // Combo 1X2+over: "1 + OVER", "2 + UNDER"
    /\b([1X2]\s*\+\s*OVER)\s+(\d+[.,]\d{1,2})\b/i,
    /\b([1X2]\s*\+\s*UNDER)\s+(\d+[.,]\d{1,2})\b/i,
    // Parziale/finale semplice: "1/1", "1/X", "X/2"
    /\b([1X2]\/[1X2])\s+(\d+[.,]\d{1,2})\b/i,
    // Over/Under semplice
    /\b(OVER)\s+(\d+[.,]\d{1,2})\b/i,
    /\b(UNDER)\s+(\d+[.,]\d{1,2})\b/i,
    // SI/NO
    /\b(SI|S[IÌ])\s+(\d+[.,]\d{1,2})\b/i,
    /\b(NO)\s+(\d+[.,]\d{1,2})\b/i,
    // GOAL/NO GOAL
    /\b(NO\s*GOAL)\s+(\d+[.,]\d{1,2})\b/i,
    /\b(GOAL)\s+(\d+[.,]\d{1,2})\b/i,
    /\b(GG|NG)\s+(\d+[.,]\d{1,2})\b/i,
    // PARI/DISPARI
    /\b(PARI|DISPARI)\s+(\d+[.,]\d{1,2})\b/i,
    // 1X2 doppia chance: "1X", "X2", "12"
    /\b(1X|X2|12)\s+(\d+[.,]\d{1,2})\b/i,
    // 1X2 semplice: "1", "X", "2" (solo se seguiti da quota)
    /\b([1X2])\s+(\d+[.,]\d{1,2})\s*$/i,
  ];

  let matchedPattern = null;
  for (const pat of selectionPatterns) {
    const m = normalized.match(pat);
    if (m) {
      matchedPattern = m;
      selection = m[1].toUpperCase().replace('SÌ', 'SI').replace(/\s+/g, ' ').trim();
      odds = parseFloat(m[2].replace(',', '.'));
      break;
    }
  }

  // Fallback: quota alla fine senza selezione riconosciuta
  if (!odds) {
    const oddsEnd = normalized.match(/\b(\d+[.,]\d{1,2})\s*$/);
    if (oddsEnd) {
      odds = parseFloat(oddsEnd[1].replace(',', '.'));
    }
  }

  // Rimuovi selezione+quota dalla descrizione
  let description = normalized;
  if (matchedPattern) {
    const idx = description.indexOf(matchedPattern[0]);
    if (idx >= 0) {
      const before = description.substring(0, idx).trim();
      const after = description.substring(idx + matchedPattern[0].length).trim();
      // Conserva testo significativo dopo la quota (es. "FISCHIO FINALE")
      if (after && /[A-Za-zÀ-ú]{3,}/.test(after)) {
        description = before + ' ' + after;
      } else {
        description = before;
      }
    }
  } else if (odds) {
    // Rimuovi solo la quota alla fine
    description = description.replace(/\s*\d+[.,]\d{1,2}\s*$/, '').trim();
  }

  // Pulizia residui
  description = description.replace(/\s+/g, ' ').trim();

  // Post-processing: se la selezione non è stata estratta ma il prediction contiene ancora
  // un pattern di selezione noto alla fine, estrailo ora
  if (!selection && description) {
    const postPatterns = [
      // Combo parziale+over alla fine: "1/1+OVER", "X/2+UNDER"
      /\s+(\d\/[1X2]\s*\+\s*(?:OVER|UNDER))\s*$/i,
      // Combo doppia chance alla fine: "1X + OVER", "X2 + UNDER"
      /\s+([1X2]{2}\s*\+\s*(?:OVER|UNDER))\s*$/i,
      // Combo singola alla fine: "1 + OVER"
      /\s+([1X2]\s*\+\s*(?:OVER|UNDER))\s*$/i,
      // Parziale/finale alla fine: "1/1", "1/X", "X/2"
      /\s+([1X2]\/[1X2])\s*$/i,
      // Over/Under alla fine
      /\s+(OVER|UNDER)\s*$/i,
      // SI/NO alla fine
      /\s+(SI|NO|S[IÌ])\s*$/i,
      // GOAL/NO GOAL alla fine
      /\s+(NO\s*GOAL|GOAL|GG|NG)\s*$/i,
      // PARI/DISPARI alla fine
      /\s+(PARI|DISPARI)\s*$/i,
      // Doppia chance alla fine
      /\s+(1X|X2|12)\s*$/i,
    ];
    for (const pp of postPatterns) {
      const pm = description.match(pp);
      if (pm) {
        selection = pm[1].toUpperCase().replace('SÌ', 'SI').replace(/\s+/g, ' ').trim();
        description = description.substring(0, pm.index).trim();
        break;
      }
    }
  }

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
  if (/^(quota|importo|vincita|puntata|giocata\s*del|aams|adm|codice|data[:\s]|ora[:\s]|bonus|ib[-]|cc[-]|nc[-]|pv[-]|pal[:\s]|avv[:\s]|singola|multipla|sistema|totale\s*importo|importo\s*scommesso|concession|punto\s*vendita|ricevuta|stato[:\s])/i.test(line.trim())) return false;
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

// ===== Parser principale scommesse =====
function parseBets(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bets = [];

  // Stato corrente durante il parsing
  let currentHeader = null; // { eventDate, sport, competition }
  let currentMatch = null;  // { match, score }

  // Fase 1: Identifica le righe e raggruppa le scommesse
  // Accumula righe di scommessa fino a trovare un nuovo inizio
  let pendingBetLines = [];

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

    // 2. Controlla se è una riga di match
    const matchInfo = parseMatchLine(line);
    if (matchInfo) {
      flushPendingBet();
      currentMatch = matchInfo;
      continue;
    }

    // 3. Controlla se è una riga di scommessa
    if (isBetDescriptionLine(line)) {
      // Se questa riga inizia una nuova scommessa, flush la precedente
      if (startsNewBet(line)) {
        flushPendingBet();
      }
      pendingBetLines.push(line);
    } else if (pendingBetLines.length > 0 && /^\s*(SI|NO|S[IÌ]|OVER|UNDER|GOAL|NO\s*GOAL|GG|NG|PARI|DISPARI|[1X2]{1,2}(?:\s*\+\s*OVER)?(?:\s*\+\s*UNDER)?|\d\/[1X2](?:\s*\+\s*OVER)?(?:\s*\+\s*UNDER)?)\s+\d+[.,]\d{1,2}\s*$/i.test(line)) {
      // Riga con selezione+quota (es: "SI 2.05", "OVER 1.33", "1X + OVER 1.31") → scommessa precedente
      pendingBetLines.push(line);
    } else if (pendingBetLines.length > 0 && /^\s*\d+[.,]\d{1,2}\s*$/i.test(line)) {
      // Riga con solo quota (es: "2.05") → appartiene alla scommessa precedente
      pendingBetLines.push(line);
    } else {
      // Riga non scommessa (summary, metadata, etc.) → flush pending
      flushPendingBet();
    }
  }
  // Flush l'ultima scommessa pendente
  flushPendingBet();

  // Fallback: se non trova nessuna scommessa strutturata
  if (bets.length === 0) {
    // Prova a trovare almeno il match con "vs"
    const vsMatch = text.match(/([A-Za-zÀ-ú][A-Za-zÀ-ú\s.']+?)\s+vs\.?\s+([A-Za-zÀ-ú][A-Za-zÀ-ú\s.']+)/i);
    const matchName = vsMatch ? `${vsMatch[1].trim()} vs ${vsMatch[2].trim()}` : 'Scommessa caricata';

    // Cerca eventuali descrizioni significative
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
    return { bets: parsedBets, stake, potentialWin, totalOdds, ticketId, playedAt };
  }

  return { bets: [{ match: 'Ticket da link', prediction: 'Da verificare manualmente', betType: 'N/D', eventDate: new Date() }], stake, potentialWin, totalOdds, ticketId, playedAt };
}

// Funzione per aprire URL con Puppeteer (browser headless reale)
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
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const page = await browser.newPage();

    // User-Agent realistico
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    });

    // Rimuovi webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // Naviga alla pagina
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Aspetta che il contenuto della pagina sia caricato (SPA)
    try {
      await page.waitForFunction(
        () => document.body.innerText.length > 200,
        { timeout: 15000 }
      );
    } catch (e) {
      // Se non trova contenuto sufficiente, aspetta ancora
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    const html = await page.content();
    const text = await page.evaluate(() => document.body.innerText);

    return { html, text };
  } finally {
    await browser.close();
  }
}

// Import ticket da URL (link condivisione Sportium o altri)
router.post('/import-url', auth, async (req, res) => {
  try {
    const { url } = req.body;
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

    console.log(`[Import URL] Apertura con browser headless: ${url}`);

    // Usa Puppeteer per caricare la pagina come un browser reale
    let html, text;
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
