const express = require('express');
const multer = require('multer');
const path = require('path');
const Tesseract = require('tesseract.js');
const Ticket = require('../models/Ticket');
const { auth } = require('../middleware/auth');

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
  const m = line.match(/^([A-Za-zÀ-ú0-9\s.'_-]{2,}?)\s+vs\.?\s+([A-Za-zÀ-ú0-9\s.'_-]{2,?})(?:\s*\((\d+[:.]\d+)\))?/i);
  if (m) {
    return {
      match: `${m[1].trim()} vs ${m[2].trim()}`,
      score: m[3] ? m[3].replace('.', ':') : '',
    };
  }
  // Pattern con "-" o "–" come separatore (ma NON per date/header)
  // Evita match con numeri puri all'inizio (date)
  const m2 = line.match(/^([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.']{1,}?)\s+[-–]\s+([A-Za-zÀ-ú][A-Za-zÀ-ú0-9\s.']{1,?})(?:\s*\((\d+[:.]\d+)\))?$/i);
  if (m2 && !line.match(/^\d{1,2}[/.-]\d{1,2}/)) {
    return {
      match: `${m2[1].trim()} vs ${m2[2].trim()}`,
      score: m2[3] ? m2[3].replace('.', ':') : '',
    };
  }
  return null;
}

// Riga di scommessa: "CELIK, ZEKI (ROMA) O SUO SOSTITUTO CARTELLINO... SI 4.32"
function parseBetLine(line) {
  // Cerca quota alla fine della riga: numero decimale (es: 4.32, 2,05)
  const oddsMatch = line.match(/\b(\d+[.,]\d{1,2})\s*$/);
  const odds = oddsMatch ? parseFloat(oddsMatch[1].replace(',', '.')) : undefined;

  // Cerca selezione SI/NO prima della quota
  const selectionMatch = line.match(/\b(SI|NO|S[IÌ]|1|X|2)\s+\d+[.,]\d/i);
  const selection = selectionMatch ? selectionMatch[1].toUpperCase().replace('SÌ', 'SI') : '';

  // Rimuovi la quota e la selezione per ottenere la descrizione
  let description = line;
  if (oddsMatch) {
    description = description.substring(0, description.lastIndexOf(oddsMatch[1])).trim();
  }
  if (selection) {
    // Rimuovi solo l'ultima occorrenza di SI/NO prima della quota
    const selIdx = description.lastIndexOf(selection);
    if (selIdx > 0 && selIdx > description.length - selection.length - 5) {
      description = description.substring(0, selIdx).trim();
    }
  }
  // Rimuovi il separatore "|" residuo
  description = description.replace(/\|\s*$/, '').trim();

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
  if (/^(quota|importo|vincita|giocata\s*del|aams|adm|codice|data[:\s]|ora[:\s]|bonus|ib[-]|cc[-]|nc[-]|pv[-]|pal[:\s]|avv[:\s]|singola|multipla|sistema|totale\s*importo|importo\s*scommesso)/i.test(line.trim())) return false;
  // Non è un barcode o codice operatore
  if (/^[A-Z]{2,3}[-]\d/i.test(line.trim())) return false;
  // Non è troppo corta (probabilmente rumore OCR)
  if (line.trim().length < 5) return false;
  // Deve contenere lettere (non solo numeri/simboli)
  if (!/[A-Za-zÀ-ú]{2,}/.test(line)) return false;
  return true;
}

// ===== Parser principale scommesse =====
function parseBets(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bets = [];

  // Stato corrente durante il parsing
  let currentHeader = null; // { eventDate, sport, competition }
  let currentMatch = null;  // { match, score }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 1. Controlla se è una riga di intestazione evento
    const header = parseEventHeader(line);
    if (header) {
      currentHeader = header;
      continue;
    }

    // 2. Controlla se è una riga di match
    const matchInfo = parseMatchLine(line);
    if (matchInfo) {
      currentMatch = matchInfo;
      continue;
    }

    // 3. Controlla se è una riga di scommessa
    if (isBetDescriptionLine(line)) {
      const bet = parseBetLine(line);

      // Se non abbiamo ancora trovato un match, potrebbe essere una scommessa standalone
      // Prova a cercare multi-riga: a volte la descrizione scommessa si estende su più righe
      // Uniamo le righe consecutive che non sono header/match/summary
      let fullLine = line;
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Se la riga successiva è una continuazione (nessuna quota alla fine della riga corrente,
        // e la riga successiva non inizia con un pattern riconoscibile)
        if (!bet.odds && isBetDescriptionLine(nextLine) && !parseEventHeader(nextLine) && !parseMatchLine(nextLine)) {
          fullLine += ' ' + nextLine;
          i++;
        } else {
          break;
        }
      }

      // Se abbiamo unito righe, ri-parsa
      const finalBet = fullLine !== line ? parseBetLine(fullLine) : bet;

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
      });
    }
  }

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
