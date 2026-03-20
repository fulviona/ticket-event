const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Accesso negato. Token mancante.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Utente non trovato.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token non valido.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Accesso riservato agli admin.' });
      }
      next();
    });
  } catch (err) {
    res.status(403).json({ message: 'Accesso negato.' });
  }
};

module.exports = { auth, adminAuth };
