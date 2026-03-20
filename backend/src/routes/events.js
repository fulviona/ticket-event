const express = require('express');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Crea evento (admin)
router.post(
  '/',
  adminAuth,
  [
    body('matchName').notEmpty().withMessage('Nome partita obbligatorio'),
    body('eventDate').notEmpty().withMessage('Data evento obbligatoria'),
    body('result').notEmpty().withMessage('Risultato obbligatorio'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const event = new Event(req.body);
      await event.save();
      res.status(201).json(event);
    } catch (err) {
      res.status(500).json({ message: 'Errore del server.' });
    }
  }
);

// Lista eventi
router.get('/', async (req, res) => {
  try {
    const events = await Event.find().sort({ eventDate: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Aggiorna evento (admin)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!event) {
      return res.status(404).json({ message: 'Evento non trovato.' });
    }
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Elimina evento (admin)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Evento non trovato.' });
    }
    res.json({ message: 'Evento eliminato.' });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Import batch eventi da API esterna (admin)
router.post('/import', adminAuth, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'Fornire un array di eventi.' });
    }
    const created = await Event.insertMany(events);
    res.status(201).json({ message: `${created.length} eventi importati.`, events: created });
  } catch (err) {
    res.status(500).json({ message: 'Errore importazione.', error: err.message });
  }
});

module.exports = router;
