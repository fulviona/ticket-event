const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  match: { type: String, required: true },
  prediction: { type: String, required: true },
  eventDate: { type: Date },
});

const ticketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  imageUrl: {
    type: String,
  },
  bets: [betSchema],
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
