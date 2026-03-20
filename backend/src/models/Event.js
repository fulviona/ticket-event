const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  matchName: {
    type: String,
    required: true,
  },
  eventDate: {
    type: Date,
    required: true,
  },
  result: {
    type: String,
    required: true,
  },
  sport: {
    type: String,
    default: 'calcio',
  },
  settled: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Event', eventSchema);
