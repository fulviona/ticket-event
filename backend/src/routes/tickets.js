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
  // Esito finale
  { pattern: /\b(1\s*x\s*2|esito\s*finale)\b/i, type: '1X2' },
  // Under/Over con soglia
  { pattern: /\b(under|over)\s*[\d.,]+/i, type: 'Under/Over' },
  // Goal/No Goal
  { pattern: /\b(goal|no\s*goal|gol|no\s*gol|gg|ng)\b/i, type: 'Goal/No Goal' },
  // Doppia Chance
  { pattern: /\b(doppia\s*chance|1x|x2|12)\b/i, type: 'Doppia Chance' },
  // Draw No Bet
  { pattern: /\b(draw\s*no\s*bet|dnb)\b/i, type: 'Draw No Bet' },
  // Marcatore (primo, ultimo, anytime)
  { pattern: /\b(marcatore|segna|goleador|primo\s*gol|ultimo\s*gol|anytime)\b/i, type: 'Marcatore' },
  // Handicap
  { pattern: /\b(handicap|hcap|hc)\s*[\d(+-]/i, type: 'Handicap' },
  // Risultato esatto
  { pattern: /\b(risultato\s*esatto|ris\.?\s*esatto)\b/i, type: 'Risultato Esatto' },
  // Parziale/Finale
  { pattern: /\b(parziale[\s/]*finale|1t[\s/]*2t|primo\s*tempo[\s/]*secondo\s*tempo)\b/i, type: 'Parziale/Finale' },
  // Combo 1X2 + U/O
  { pattern: /\b(1\s*(?:over|under)|x\s*(?:over|under)|2\s*(?:over|under))\b/i, type: 'Combo 1X2+U/O' },
  // Somma Goal
  { pattern: /\b(somma\s*gol|somma\s*goal|totale\s*gol)\b/i, type: 'Somma Goal' },
  // Multigol
  { pattern: /\b(multigol|multi\s*gol)\b/i, type: 'Multigol' },
  // Pari/Dispari
  { pattern: /\b(pari[\s/]*dispari|odd[\s/]*even)\b/i, type: 'Pari/Dispari' },
  // Calci d'angolo
  { pattern: /\b(corner|angoli|calci\s*d'angolo)\b/i, type: 'Corner' },
  // Cartellini
  { pattern: /\b(cartellini|ammonizioni|espulsioni|cartellino)\b/i, type: 'Cartellini' },
  // Tiri in porta
  { pattern: /\b(tiri?\s*in\s*porta|shots?\s*on\s*target)\b/i, type: 'Tiri in Porta' },
  // Supplementari
  { pattern: /\b(supplementari|overtime|extra\s*time)\b/i, type: 'Supplementari' },
];

function detectBetType(text) {
  for (const { pattern, type } of BET_TYPES) {
    if (pattern.test(text)) return type;
  }
  return 'N/D';
}

// ===== Estrazione codice AAMS/ADM =====
function extractTicketId(text) {
  // Pattern AAMS: codice alfanumerico tipico dei ticket ADM
  // Es: "AAMS: DF07EA03112F39C1DB02" o "Codice: ABC123..." o sequenze hex lunghe
  const patterns = [
    /AAMS[:\s]*([A-Z0-9]{10,})/i,
    /ADM[:\s]*([A-Z0-9]{10,})/i,
    /codice[:\s]*([A-Z0-9]{10,})/i,
    /ID[:\s]*([A-Z0-9]{10,})/i,
    /\b([A-F0-9]{16,})\b/i, // sequenze hex lunghe tipiche dei ticket
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

// ===== Estrazione importi =====
function extractAmount(text, label) {
  // Cerca "Importo pagato: 50,00 €" o "Vincita potenziale: 350,00 €"
  const pattern = new RegExp(label + '[:\\s]*([\\d.,]+)\\s*(?:€|eur)?', 'i');
  const m = text.match(pattern);
  if (m) {
    return parseFloat(m[1].replace('.', '').replace(',', '.'));
  }
  return null;
}

function extractOdds(text) {
  // Cerca "Quota totale: 7.00" o "Quota: 7,00"
  const pattern = /quota\s*(?:totale)?[:\s]*([\d.,]+)/i;
  const m = text.match(pattern);
  if (m) {
    return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

// ===== Parsing scommesse migliorato =====
function parseBets(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bets = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Cerca pattern partita: "Squadra A vs Squadra B" o "Squadra A - Squadra B"
    const matchPattern = /([A-Za-zÀ-ú0-9\s.]+?)\s+(?:vs\.?|[-–]|contro)\s+([A-Za-zÀ-ú0-9\s.]+?)(?:\s*\(|$|\s+[-–])/i;
    const matchResult = line.match(matchPattern);

    if (matchResult) {
      const matchName = `${matchResult[1].trim()} vs ${matchResult[2].trim()}`;

      // Cerca la previsione/selezione nelle righe vicine
      let prediction = '';
      let betType = detectBetType(line);

      // Controlla la riga successiva per dettaglio scommessa
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (betType === 'N/D') {
          betType = detectBetType(nextLine);
        }
        // Se la riga successiva non è un'altra partita, è il dettaglio
        if (!nextLine.match(/[A-Za-zÀ-ú]+\s+(?:vs|[-–]|contro)\s+/i)) {
          prediction = nextLine;
        }
      }

      if (!prediction) {
        prediction = line.replace(matchResult[0], '').trim() || 'N/D';
      }

      // Cerca quota nella riga
      const oddsMatch = line.match(/\b(\d+[.,]\d{2})\s*$/);
      const odds = oddsMatch ? parseFloat(oddsMatch[1].replace(',', '.')) : undefined;

      bets.push({
        match: matchName,
        prediction,
        betType,
        odds,
        eventDate: new Date(),
      });
    }
  }

  // Fallback se non trova partite con pattern standard
  if (bets.length === 0 && lines.length > 0) {
    bets.push({
      match: lines[0].substring(0, 80),
      prediction: lines[1] || 'N/D',
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
  'annullata',
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

    // Estrai importi e quota
    const stake = extractAmount(text, 'importo\\s*pagato');
    const potentialWin = extractAmount(text, 'vincita\\s*potenziale');
    const totalOdds = extractOdds(text);

    const ticket = new Ticket({
      user: req.user._id,
      ticketId,
      ocrRawText: text,
      bets,
      stake,
      potentialWin,
      totalOdds,
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
