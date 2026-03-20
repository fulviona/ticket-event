const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  match: { type: String, required: true },
  prediction: { type: String, required: true },
  betType: { type: String, default: 'N/D' }, // es: 1X2, Over/Under, Marcatore, Handicap...
  odds: { type: Number },
  eventDate: { type: Date },
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
    sparse: true, // permette null ma se presente deve essere unico
  },
  bets: [betSchema],
  stake: { type: Number }, // importo puntato
  potentialWin: { type: Number }, // vincita potenziale
  totalOdds: { type: Number }, // quota totale
  status: {
    type: String,
    enum: ['pending', 'won', 'lost'],
    default: 'pending',
  },
  ocrRawText: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);
