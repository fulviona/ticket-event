const express = require('express');
const multer = require('multer');
const path = require('path');
const Tesseract = require('tesseract.js');
const Ticket = require('../models/Ticket');
const { auth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Solo immagini JPG, PNG o WebP'));
  },
});

function parseBets(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  const bets = [];
  for (const line of lines) {
    const matchPattern = /([A-Za-zÀ-ú\s]+[\s-]+(?:vs|[-]|contro)[\s-]+[A-Za-zÀ-ú\s]+)/i;
    const matchResult = line.match(matchPattern);
    if (matchResult) {
      bets.push({
        match: matchResult[1].trim(),
        prediction: line.replace(matchResult[1], '').trim() || 'N/D',
        eventDate: new Date(),
      });
    }
  }
  if (bets.length === 0 && lines.length > 0) {
    bets.push({
      match: lines[0].substring(0, 50),
      prediction: lines[1] || 'N/D',
      eventDate: new Date(),
    });
  }
  return bets;
}

// Upload ticket con OCR
router.post('/upload', auth, upload.single('ticket'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nessuna immagine caricata.' });
    }

    const { data: { text } } = await Tesseract.recognize(req.file.path, 'ita+eng');

    const bets = parseBets(text);

    const ticket = new Ticket({
      user: req.user._id,
      imageUrl: `/uploads/${req.file.filename}`,
      ocrRawText: text,
      bets,
    });

    await ticket.save();

    res.status(201).json({
      message: 'Ticket caricato e analizzato!',
      ticket,
    });
  } catch (err) {
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

// Tutti i ticket (admin)
router.get('/all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Accesso riservato.' });
    }
    const tickets = await Ticket.find().populate('user', 'email phone').sort({ createdAt: -1 });
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

module.exports = router;
