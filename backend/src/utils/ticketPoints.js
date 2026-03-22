const User = require('../models/User');

/**
 * Allinea i punti utente al cambio stato di un ticket (stessa logica delle route admin).
 */
async function syncPointsOnTicketStatusChange(userId, previousStatus, newStatus) {
  const prev = String(previousStatus || 'pending');
  const next = String(newStatus || 'pending');
  if (next === 'won' && prev !== 'won') {
    await User.findByIdAndUpdate(userId, { $inc: { points: 1 } });
  } else if (prev === 'won' && next !== 'won') {
    await User.findByIdAndUpdate(userId, { $inc: { points: -1 } });
  }
}

module.exports = { syncPointsOnTicketStatusChange };
