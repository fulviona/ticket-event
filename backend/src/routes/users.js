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

// Aggiorna profilo (password, newsletter, avatar)
router.patch('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato.' });
    }

    const { currentPassword, newPassword, newsletterConsent, avatar } = req.body;

    // Cambio password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Inserisci la password attuale.' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Password attuale non corretta.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'La nuova password deve avere almeno 6 caratteri.' });
      }
      user.password = newPassword;
    }

    // Newsletter
    if (typeof newsletterConsent === 'boolean') {
      user.newsletterConsent = newsletterConsent;
    }

    // Avatar (base64 o null per rimuovere)
    if (avatar !== undefined) {
      // Limita dimensione avatar a ~500KB in base64
      if (avatar && avatar.length > 700000) {
        return res.status(400).json({ message: 'Immagine troppo grande. Max 500KB.' });
      }
      user.avatar = avatar;
    }

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ message: 'Profilo aggiornato.', user: userObj });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Classifica utenti per punti (mostra alias)
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' })
      .select('alias points avatar')
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
