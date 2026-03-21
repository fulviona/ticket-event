const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Analytics giornaliere con filtro data
router.get('/', adminAuth, async (req, res) => {
  try {
    const { date } = req.query;

    // Data selezionata (default: oggi)
    const selectedDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const dateFilter = { $gte: startOfDay, $lte: endOfDay };

    // Contatori giornalieri
    const [
      newUsersToday,
      ticketsUploadedToday,
      ticketsSharedToday,
      ticketsWonToday,
      ticketsLostToday,
      ticketsPendingToday,
    ] = await Promise.all([
      User.countDocuments({ createdAt: dateFilter }),
      Ticket.countDocuments({ createdAt: dateFilter }),
      Ticket.countDocuments({ createdAt: dateFilter, shared: true }),
      Ticket.countDocuments({ createdAt: dateFilter, status: 'won' }),
      Ticket.countDocuments({ createdAt: dateFilter, status: 'lost' }),
      Ticket.countDocuments({ createdAt: dateFilter, status: 'pending' }),
    ]);

    // Totali complessivi
    const [
      totalUsers,
      totalActiveUsers,
      totalBlockedUsers,
      totalTickets,
      totalSharedTickets,
      totalWonTickets,
      totalLostTickets,
      totalPendingTickets,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ blocked: { $ne: true } }),
      User.countDocuments({ blocked: true }),
      Ticket.countDocuments(),
      Ticket.countDocuments({ shared: true }),
      Ticket.countDocuments({ status: 'won' }),
      Ticket.countDocuments({ status: 'lost' }),
      Ticket.countDocuments({ status: 'pending' }),
    ]);

    // Statistiche importi del giorno
    const stakeStatsToday = await Ticket.aggregate([
      { $match: { createdAt: dateFilter, stake: { $exists: true, $ne: null } } },
      { $group: { _id: null, totalStake: { $sum: '$stake' }, totalPotentialWin: { $sum: '$potentialWin' } } },
    ]);

    // Statistiche importi totali
    const stakeStatsTotal = await Ticket.aggregate([
      { $match: { stake: { $exists: true, $ne: null } } },
      { $group: { _id: null, totalStake: { $sum: '$stake' }, totalPotentialWin: { $sum: '$potentialWin' } } },
    ]);

    // Spazio DB (MongoDB stats)
    const db = mongoose.connection.db;
    const dbStats = await db.stats();

    // Top 5 utenti per punti
    const topUsers = await User.find({ role: 'user' })
      .select('alias points')
      .sort({ points: -1 })
      .limit(5);

    // Utenti che hanno caricato ticket oggi
    const activeUploadersToday = await Ticket.distinct('user', { createdAt: dateFilter });

    res.json({
      date: startOfDay.toISOString().split('T')[0],
      daily: {
        newUsers: newUsersToday,
        ticketsUploaded: ticketsUploadedToday,
        ticketsShared: ticketsSharedToday,
        ticketsWon: ticketsWonToday,
        ticketsLost: ticketsLostToday,
        ticketsPending: ticketsPendingToday,
        activeUploaders: activeUploadersToday.length,
        totalStake: stakeStatsToday[0]?.totalStake || 0,
        totalPotentialWin: stakeStatsToday[0]?.totalPotentialWin || 0,
      },
      totals: {
        users: totalUsers,
        activeUsers: totalActiveUsers,
        blockedUsers: totalBlockedUsers,
        tickets: totalTickets,
        sharedTickets: totalSharedTickets,
        wonTickets: totalWonTickets,
        lostTickets: totalLostTickets,
        pendingTickets: totalPendingTickets,
        totalStake: stakeStatsTotal[0]?.totalStake || 0,
        totalPotentialWin: stakeStatsTotal[0]?.totalPotentialWin || 0,
      },
      database: {
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexSize: dbStats.indexSize,
        totalSize: dbStats.dataSize + dbStats.indexSize,
        collections: dbStats.collections,
        objects: dbStats.objects,
      },
      topUsers,
    });
  } catch (err) {
    console.error('Errore analytics:', err);
    res.status(500).json({ message: 'Errore del server.' });
  }
});

module.exports = router;
