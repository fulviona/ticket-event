const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  match: { type: String, required: true }, // Es: "Roma vs Bologna"
  sport: { type: String, default: '' }, // Es: "Calcio"
  competition: { type: String, default: '' }, // Es: "Europa League"
  prediction: { type: String, required: true }, // Descrizione completa della scommessa
  selection: { type: String, default: '' }, // Selezione: SI, NO, 1, X, 2, Over, Under...
  betType: { type: String, default: 'N/D' }, // Categoria scommessa
  player: { type: String, default: '' }, // Nome giocatore (se scommessa su giocatore)
  odds: { type: Number },
  eventDate: { type: Date },
  score: { type: String, default: '' }, // Risultato live/finale es: "3:3"
});

const ticketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ticketId: {
    type: String,
    unique: true,
    sparse: true,
  },
  bets: [betSchema],
  stake: { type: Number },
  potentialWin: { type: Number },
  totalOdds: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending',
  },
  shared: {
    type: Boolean,
    default: false,
  },
  ocrRawText: {
    type: String,
  },
  playedAt: { type: Date }, // Data/ora della giocata
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);
