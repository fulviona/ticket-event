require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// Connessione DB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
// Le immagini non vengono più salvate su disco

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/events', require('./routes/events'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check
const pkg = require('../package.json');
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', backendVersion: pkg.version })
);

// Setup admin (one-time use, remove after first admin is created)
app.post('/api/setup-admin', async (req, res) => {
  try {
    const User = require('./models/User');
    const existing = await User.findOne({ email: 'admin@ticketevent.it' });
    if (existing) {
      existing.role = 'admin';
      await existing.save();
      return res.json({ message: 'Utente promosso ad admin.' });
    }
    const admin = new User({
      alias: 'Admin',
      email: 'admin@ticketevent.it',
      password: 'Admin2026!',
      phone: '+39000000000',
      dateOfBirth: new Date('1990-01-01'),
      privacyConsent: true,
      cookieConsent: true,
      role: 'admin',
    });
    await admin.save();
    res.status(201).json({ message: 'Admin creato con successo.' });
  } catch (err) {
    res.status(500).json({ message: 'Errore: ' + err.message });
  }
});

// Serve frontend in produzione (single repo deploy)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
  if (process.env.API_FOOTBALL_KEY && process.env.AUTO_SETTLEMENT_CRON !== 'false') {
    try {
      const cron = require('node-cron');
      const { runAutoSettlementJob } = require('./services/autoSettlement');
      cron.schedule(process.env.AUTO_SETTLEMENT_SCHEDULE || '*/20 * * * *', () => {
        runAutoSettlementJob().catch((e) => console.error('[autoSettlement]', e.message));
      });
      console.log('[autoSettlement] Cron attivo (API-Football)');
    } catch (e) {
      console.warn('[autoSettlement] Cron non avviato:', e.message);
    }
  } else if (!process.env.API_FOOTBALL_KEY) {
    console.log('[autoSettlement] Disattivato: impostare API_FOOTBALL_KEY per refertazione automatica calcio');
  }
});
