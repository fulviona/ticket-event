const express = require('express');
const crypto = require('crypto');
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

    if (typeof newsletterConsent === 'boolean') {
      user.newsletterConsent = newsletterConsent;
    }

    if (avatar !== undefined) {
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
    const users = await User.find({ role: 'user', blocked: { $ne: true } })
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

// Admin: aggiorna alias utente
router.patch('/:id/alias', adminAuth, async (req, res) => {
  try {
    const { alias } = req.body;
    if (!alias || alias.length < 3 || alias.length > 20) {
      return res.status(400).json({ message: 'Alias deve essere tra 3 e 20 caratteri.' });
    }

    const existing = await User.findOne({ alias: { $regex: new RegExp(`^${alias}$`, 'i') }, _id: { $ne: req.params.id } });
    if (existing) {
      return res.status(400).json({ message: 'Questo alias è già in uso.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { alias }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'Utente non trovato.' });

    res.json({ message: 'Alias aggiornato.', user });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Admin: blocca/sblocca utente
router.patch('/:id/block', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato.' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Non puoi bloccare un admin.' });

    user.blocked = !user.blocked;
    await user.save();

    res.json({ message: user.blocked ? 'Utente bloccato.' : 'Utente sbloccato.', user });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Admin: elimina utente
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato.' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Non puoi eliminare un admin.' });

    // Elimina anche i ticket dell'utente
    const Ticket = require('../models/Ticket');
    await Ticket.deleteMany({ user: req.params.id });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Utente e relativi ticket eliminati.' });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Admin: invia password provvisoria
router.patch('/:id/temp-password', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Utente non trovato.' });

    const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 caratteri
    user.password = tempPassword;
    await user.save();

    res.json({ message: 'Password provvisoria generata.', tempPassword });
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

// Admin: export utenti in formato CSV (Excel-compatibile)
router.get('/export/excel', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password -avatar').sort({ createdAt: -1 });

    const header = 'Alias;Email;Telefono;Data Nascita;Punti;Newsletter;Ruolo;Bloccato;Registrato il';
    const rows = users.map((u) => {
      return [
        u.alias || '',
        u.email,
        u.phone,
        u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('it-IT') : '',
        u.points,
        u.newsletterConsent ? 'Si' : 'No',
        u.role,
        u.blocked ? 'Si' : 'No',
        new Date(u.createdAt).toLocaleDateString('it-IT'),
      ].join(';');
    });

    const csv = '\uFEFF' + header + '\n' + rows.join('\n'); // BOM per Excel
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="utenti.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Errore del server.' });
  }
});

module.exports = router;
