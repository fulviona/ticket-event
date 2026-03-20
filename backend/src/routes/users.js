const express = require('express');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Profilo utente corrente
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Classifica utenti per punti
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('email points')
      .sort({ points: -1 })
      .limit(50);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Lista tutti gli utenti (admin)
router.get('/all', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

module.exports = router;
