import React, { useState, useEffect, useRef } from 'react';
import { uploadTicket, getMyTickets } from '../services/api';

function Home({ user }) {
  const [tickets, setTickets] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const res = await getMyTickets();
      setTickets(res.data);
    } catch (err) {
      console.error('Errore caricamento ticket:', err);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('ticket', file);

    try {
      const res = await uploadTicket(formData);
      setMessage('Ticket caricato e analizzato con successo!');
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante il caricamento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="upload-section">
        <h2>Carica il tuo Ticket</h2>
        <p style={{ color: '#78909c', marginBottom: '1rem' }}>
          Scatta una foto della tua scommessa e il sistema la leggera automaticamente
        </p>

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}

        <div className="upload-area" onClick={() => fileRef.current?.click()}>
          {preview ? (
            <img src={preview} alt="Anteprima ticket" className="preview-img" />
          ) : (
            <p>Clicca o trascina qui la foto del ticket</p>
          )}
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          ref={fileRef}
          style={{ display: 'none' }}
        />

        <button
          className="btn-primary"
          style={{ maxWidth: '300px' }}
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Analisi in corso...' : 'Carica e Analizza'}
        </button>
      </div>

      <div className="tickets-section">
        <h3>I tuoi Ticket ({tickets.length})</h3>
        {tickets.length === 0 && (
          <p style={{ color: '#78909c', marginTop: '0.5rem' }}>Nessun ticket caricato ancora.</p>
        )}
        {tickets.map((ticket) => (
          <div key={ticket._id} className={`ticket-card ${ticket.status}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: '#78909c', fontSize: '0.85rem' }}>
                {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
                {ticket.ticketId && (
                  <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    ID: {ticket.ticketId.substring(0, 12)}...
                  </span>
                )}
              </span>
              <span className={`ticket-status ${ticket.status}`}>
                {ticket.status === 'won' ? 'Vinto' : ticket.status === 'lost' ? 'Perso' : 'In attesa'}
              </span>
            </div>
            {ticket.bets.map((bet, i) => (
              <div key={i} className="bet-item">
                <strong>{bet.match}</strong> - <span style={{ color: '#4fc3f7' }}>{bet.prediction}</span>
                {bet.betType && bet.betType !== 'N/D' && (
                  <span style={{
                    marginLeft: '0.5rem',
                    background: '#1a3a4a',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#80cbc4',
                  }}>
                    {bet.betType}
                  </span>
                )}
                {bet.odds && (
                  <span style={{ marginLeft: '0.5rem', color: '#ffb74d', fontSize: '0.8rem' }}>
                    @{bet.odds.toFixed(2)}
                  </span>
                )}
                {bet.eventDate && (
                  <span style={{ color: '#78909c', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    ({new Date(bet.eventDate).toLocaleDateString('it-IT')})
                  </span>
                )}
              </div>
            ))}
            {(ticket.stake || ticket.potentialWin || ticket.totalOdds) && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #2a3a4a', fontSize: '0.85rem', display: 'flex', gap: '1rem' }}>
                {ticket.stake && <span>Puntata: <strong>{ticket.stake.toFixed(2)}€</strong></span>}
                {ticket.totalOdds && <span style={{ color: '#ffb74d' }}>Quota: {ticket.totalOdds.toFixed(2)}</span>}
                {ticket.potentialWin && <span style={{ color: '#66bb6a' }}>Vincita: <strong>{ticket.potentialWin.toFixed(2)}€</strong></span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
