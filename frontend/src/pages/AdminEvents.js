import React, { useState, useEffect } from 'react';
import { getEvents, createEvent, deleteEvent } from '../services/api';

function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ matchName: '', eventDate: '', result: '', sport: 'calcio' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const res = await getEvents();
      setEvents(res.data);
    } catch (err) {
      console.error('Errore caricamento eventi:', err);
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
      loadEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore creazione evento.');
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteEvent(id);
      loadEvents();
    } catch (err) {
      console.error('Errore eliminazione:', err);
    }
  };

  return (
    <div className="admin-page">
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

      <div className="table-responsive">
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
      </div>
    </div>
  );
}

export default AdminEvents;
