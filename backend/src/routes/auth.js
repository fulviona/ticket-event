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
      const { email, password, phone, dateOfBirth, newsletterConsent, privacyConsent, cookieConsent } = req.body;

      if (!isAdult(dateOfBirth)) {
        return res.status(400).json({ message: 'Devi essere maggiorenne per registrarti.' });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email già registrata.' });
      }

      const user = new User({
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
          email: user.email,
          phone: user.phone,
          role: user.role,
          points: user.points,
        },
      });
    } catch (err) {
      res.status(500).json({ message: 'Errore del server.' });
    }
  }
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email non valida'),
    body('password').notEmpty().withMessage('Password obbligatoria'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
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
          email: user.email,
          phone: user.phone,
          role: user.role,
          points: user.points,
        },
      });
    } catch (err) {
      res.status(500).json({ message: 'Errore del server.' });
    }
  }
);

module.exports = router;
