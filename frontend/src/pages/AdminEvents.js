import React, { useState, useEffect } from 'react';
import { getEvents, createEvent, deleteEvent, getAllTickets, updateTicketStatus } from '../services/api';

function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('events');
  const [form, setForm] = useState({ matchName: '', eventDate: '', result: '', sport: 'calcio' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [evRes, tkRes] = await Promise.all([getEvents(), getAllTickets()]);
      setEvents(evRes.data);
      setTickets(tkRes.data);
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await createEvent(form);
      setMessage('Evento creato!');
      setForm({ matchName: '', eventDate: '', result: '', sport: 'calcio' });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore creazione evento.');
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteEvent(id);
      loadData();
    } catch (err) {
      console.error('Errore eliminazione:', err);
    }
  };

  const handleTicketStatus = async (id, status) => {
    try {
      await updateTicketStatus(id, status);
      loadData();
    } catch (err) {
      console.error('Errore aggiornamento:', err);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn-small ${tab === 'events' ? 'btn-success' : ''}`}
          style={{ background: tab === 'events' ? '#4fc3f7' : '#37474f', color: 'white' }}
          onClick={() => setTab('events')}
        >
          Eventi / API
        </button>
        <button
          className={`btn-small ${tab === 'tickets' ? 'btn-success' : ''}`}
          style={{ background: tab === 'tickets' ? '#4fc3f7' : '#37474f', color: 'white' }}
          onClick={() => setTab('tickets')}
        >
          Refertazione Ticket
        </button>
      </div>

      {tab === 'events' && (
        <>
          <h2>Gestione Eventi</h2>
          {message && <div className="success-msg">{message}</div>}
          {error && <div className="error-msg">{error}</div>}

          <form className="event-form" onSubmit={handleCreateEvent}>
            <div>
              <label style={{ display: 'block', color: '#78909c', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Partita</label>
              <input
                placeholder="Es: Roma - Lazio"
                value={form.matchName}
                onChange={(e) => setForm({ ...form, matchName: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#78909c', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Data/Ora</label>
              <input
                type="datetime-local"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#78909c', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Risultato</label>
              <input
                placeholder="Es: 2-1"
                value={form.result}
                onChange={(e) => setForm({ ...form, result: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn-small btn-success">Aggiungi</button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Partita</th>
                <th>Data</th>
                <th>Risultato</th>
                <th>Sport</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev._id}>
                  <td>{ev.matchName}</td>
                  <td>{new Date(ev.eventDate).toLocaleString('it-IT')}</td>
                  <td style={{ fontWeight: 'bold' }}>{ev.result}</td>
                  <td>{ev.sport}</td>
                  <td>
                    <button className="btn-small btn-danger" onClick={() => handleDeleteEvent(ev._id)}>
                      Elimina
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'tickets' && (
        <>
          <h2>Refertazione Ticket</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Utente</th>
                <th>Giocate</th>
                <th>Stato</th>
                <th>Data</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket._id}>
                  <td>{ticket.user?.email || 'N/D'}</td>
                  <td>
                    {ticket.bets.map((b, i) => (
                      <div key={i} style={{ fontSize: '0.85rem' }}>
                        {b.match} - {b.prediction}
                      </div>
                    ))}
                  </td>
                  <td>
                    <span className={`ticket-status ${ticket.status}`}>
                      {ticket.status === 'won' ? 'Vinto' : ticket.status === 'lost' ? 'Perso' : 'In attesa'}
                    </span>
                  </td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString('it-IT')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button className="btn-small btn-success" onClick={() => handleTicketStatus(ticket._id, 'won')}>
                        Vinto
                      </button>
                      <button className="btn-small btn-danger" onClick={() => handleTicketStatus(ticket._id, 'lost')}>
                        Perso
                      </button>
                      <button className="btn-small btn-warning" onClick={() => handleTicketStatus(ticket._id, 'pending')}>
                        Attesa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default AdminEvents;
