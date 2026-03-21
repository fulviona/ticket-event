import React, { useState, useEffect } from 'react';
import { getAnalytics } from '../services/api';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [loading, setLoading] = useState(true);

  // Limiti calendario: max 31 giorni nel passato, max oggi
  const today = formatDate(new Date());
  const minDate = formatDate(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000));

  useEffect(() => {
    loadAnalytics(selectedDate);
  }, [selectedDate]);

  const loadAnalytics = async (date) => {
    setLoading(true);
    try {
      const res = await getAnalytics(date);
      setData(res.data);
    } catch (err) {
      console.error('Errore caricamento analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  if (loading && !data) {
    return <div className="admin-page"><p style={{ color: '#78909c' }}>Caricamento analytics...</p></div>;
  }

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Analytics</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ color: '#b0bec5', fontSize: '0.9rem' }}>Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            min={minDate}
            max={today}
            className="analytics-date-input"
          />
        </div>
      </div>

      {loading && <p style={{ color: '#78909c', marginBottom: '1rem' }}>Aggiornamento...</p>}

      {data && (
        <>
          {/* Statistiche giornaliere */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">
              Statistiche del {new Date(data.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </h3>
            <div className="analytics-grid">
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#4fc3f7' }}>{data.daily.newUsers}</span>
                <span className="analytics-card-label">Nuovi utenti</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#4fc3f7' }}>{data.daily.activeUploaders}</span>
                <span className="analytics-card-label">Utenti attivi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ffb74d' }}>{data.daily.ticketsUploaded}</span>
                <span className="analytics-card-label">Ticket caricati</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#81c784' }}>{data.daily.ticketsShared}</span>
                <span className="analytics-card-label">Ticket condivisi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#66bb6a' }}>{data.daily.ticketsWon}</span>
                <span className="analytics-card-label">Vinti</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ef5350' }}>{data.daily.ticketsLost}</span>
                <span className="analytics-card-label">Persi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ff9800' }}>{data.daily.ticketsPending}</span>
                <span className="analytics-card-label">In attesa</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ce93d8' }}>{data.daily.totalStake.toFixed(2)}&euro;</span>
                <span className="analytics-card-label">Puntate del giorno</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#80cbc4' }}>{data.daily.totalPotentialWin.toFixed(2)}&euro;</span>
                <span className="analytics-card-label">Vincite potenziali</span>
              </div>
            </div>
          </div>

          {/* Totali complessivi */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">Totali complessivi</h3>
            <div className="analytics-grid">
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#4fc3f7' }}>{data.totals.users}</span>
                <span className="analytics-card-label">Utenti totali</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#66bb6a' }}>{data.totals.activeUsers}</span>
                <span className="analytics-card-label">Utenti attivi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ef5350' }}>{data.totals.blockedUsers}</span>
                <span className="analytics-card-label">Utenti bloccati</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ffb74d' }}>{data.totals.tickets}</span>
                <span className="analytics-card-label">Ticket totali</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#81c784' }}>{data.totals.sharedTickets}</span>
                <span className="analytics-card-label">Condivisi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#66bb6a' }}>{data.totals.wonTickets}</span>
                <span className="analytics-card-label">Vinti</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ef5350' }}>{data.totals.lostTickets}</span>
                <span className="analytics-card-label">Persi</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ff9800' }}>{data.totals.pendingTickets}</span>
                <span className="analytics-card-label">In attesa</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ce93d8' }}>{data.totals.totalStake.toFixed(2)}&euro;</span>
                <span className="analytics-card-label">Puntate totali</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#80cbc4' }}>{data.totals.totalPotentialWin.toFixed(2)}&euro;</span>
                <span className="analytics-card-label">Vincite potenziali tot.</span>
              </div>
            </div>
          </div>

          {/* Database */}
          <div className="analytics-section">
            <h3 className="analytics-section-title">Database</h3>
            <div className="analytics-grid">
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#4fc3f7' }}>{formatBytes(data.database.dataSize)}</span>
                <span className="analytics-card-label">Dati</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ffb74d' }}>{formatBytes(data.database.storageSize)}</span>
                <span className="analytics-card-label">Storage allocato</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#ce93d8' }}>{formatBytes(data.database.indexSize)}</span>
                <span className="analytics-card-label">Indici</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#81c784' }}>{formatBytes(data.database.totalSize)}</span>
                <span className="analytics-card-label">Spazio totale</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#78909c' }}>{data.database.collections}</span>
                <span className="analytics-card-label">Collezioni</span>
              </div>
              <div className="analytics-card">
                <span className="analytics-card-value" style={{ color: '#78909c' }}>{data.database.objects}</span>
                <span className="analytics-card-label">Documenti</span>
              </div>
            </div>
          </div>

          {/* Top utenti */}
          {data.topUsers && data.topUsers.length > 0 && (
            <div className="analytics-section">
              <h3 className="analytics-section-title">Top 5 Player</h3>
              <div className="analytics-top-users">
                {data.topUsers.map((u, i) => (
                  <div key={u._id} className="analytics-top-user">
                    <span className={`analytics-rank rank-${i + 1}`}>#{i + 1}</span>
                    <span className="analytics-top-alias">{u.alias || 'N/D'}</span>
                    <span className="analytics-top-points">{u.points} pt</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminAnalytics;
