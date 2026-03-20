const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function isAdult(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

// Registrazione
router.post(
  '/register',
  [
    body('alias').isLength({ min: 3, max: 20 }).withMessage('Alias deve essere tra 3 e 20 caratteri'),
    body('email').isEmail().withMessage('Email non valida'),
    body('password').isLength({ min: 6 }).withMessage('Password minimo 6 caratteri'),
    body('phone').notEmpty().withMessage('Numero di telefono obbligatorio'),
    body('dateOfBirth').notEmpty().withMessage('Data di nascita obbligatoria'),
    body('privacyConsent').equals('true').withMessage('Devi accettare la privacy policy'),
    body('cookieConsent').equals('true').withMessage('Devi accettare i cookie'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { alias, email, password, phone, dateOfBirth, newsletterConsent, privacyConsent, cookieConsent } = req.body;

      if (!isAdult(dateOfBirth)) {
        return res.status(400).json({ message: 'Devi essere maggiorenne per registrarti.' });
      }

      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email già registrata.' });
      }

      const existingAlias = await User.findOne({ alias: { $regex: new RegExp(`^${alias}$`, 'i') } });
      if (existingAlias) {
        return res.status(400).json({ message: 'Questo alias è già in uso. Scegline un altro.' });
      }

      const user = new User({
        alias,
        email,
        password,
        phone,
        dateOfBirth,
        newsletterConsent: newsletterConsent === 'true' || newsletterConsent === true,
        privacyConsent: true,
        cookieConsent: true,
      });

      await user.save();

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: {
          id: user._id,
          alias: user.alias,
          email: user.email,
          phone: user.phone,
          role: user.role,
          points: user.points,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      res.status(500).json({ message: 'Errore del server.' });
    }
  }
);

// Login (con alias o email)
router.post(
  '/login',
  [
    body('login').notEmpty().withMessage('Inserisci alias o email'),
    body('password').notEmpty().withMessage('Password obbligatoria'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { login, password } = req.body;

      // Cerca per email o alias
      const user = await User.findOne({
        $or: [
          { email: login.toLowerCase() },
          { alias: { $regex: new RegExp(`^${login}$`, 'i') } },
        ],
      });

      if (!user) {
        return res.status(400).json({ message: 'Credenziali non valide.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Credenziali non valide.' });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        token,
        user: {
          id: user._id,
          alias: user.alias,
          email: user.email,
          phone: user.phone,
          role: user.role,
          points: user.points,
          avatar: user.avatar,
        },
      });
    } catch (err) {
      res.status(500).json({ message: 'Errore del server.' });
    }
  }
);

module.exports = router;
