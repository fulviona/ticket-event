import React, { useState, useEffect, useRef } from 'react';
import { uploadTicket, getMyTickets, getSharedTickets, toggleShareTicket } from '../services/api';

function Home({ user }) {
  const [tickets, setTickets] = useState([]);
  const [sharedTickets, setSharedTickets] = useState([]);
  const [tab, setTab] = useState('my');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    loadTickets();
    loadShared();
  }, []);

  const loadTickets = async () => {
    try {
      const res = await getMyTickets();
      setTickets(res.data);
    } catch (err) {
      console.error('Errore caricamento ticket:', err);
    }
  };

  const loadShared = async () => {
    try {
      const res = await getSharedTickets();
      setSharedTickets(res.data);
    } catch (err) {
      console.error('Errore caricamento ticket condivisi:', err);
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
      await uploadTicket(formData);
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

  const handleShare = async (id) => {
    try {
      await toggleShareTicket(id);
      loadTickets();
      loadShared();
    } catch (err) {
      console.error('Errore condivisione:', err);
    }
  };

  // Raggruppa le scommesse per partita
  const groupBetsByMatch = (bets) => {
    const groups = [];
    let currentGroup = null;

    for (const bet of bets) {
      if (!currentGroup || currentGroup.match !== bet.match) {
        currentGroup = {
          match: bet.match,
          sport: bet.sport || '',
          competition: bet.competition || '',
          score: bet.score || '',
          eventDate: bet.eventDate,
          bets: [],
        };
        groups.push(currentGroup);
      }
      currentGroup.bets.push(bet);
    }
    return groups;
  };

  const renderTicketCard = (ticket, showUser) => {
    const matchGroups = groupBetsByMatch(ticket.bets);

    return (
      <div key={ticket._id} className={`ticket-card ${ticket.status}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ color: '#78909c', fontSize: '0.85rem' }}>
            {showUser && ticket.user && (
              <span style={{ color: '#4fc3f7', marginRight: '0.5rem' }}>
                {ticket.user.avatar && (
                  <img src={ticket.user.avatar} alt="" style={{ width: 20, height: 20, borderRadius: '50%', verticalAlign: 'middle', marginRight: 4 }} />
                )}
                {ticket.user.alias}
              </span>
            )}
            {new Date(ticket.playedAt || ticket.createdAt).toLocaleDateString('it-IT', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
            {ticket.ticketId && (
              <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                ID: {ticket.ticketId.substring(0, 12)}...
              </span>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!showUser && (
              <button
                className="btn-small"
                style={{
                  background: ticket.shared ? '#2e7d32' : '#37474f',
                  color: 'white',
                  fontSize: '0.75rem',
                }}
                onClick={() => handleShare(ticket._id)}
                title={ticket.shared ? 'Clicca per nascondere' : 'Clicca per condividere'}
              >
                {ticket.shared ? 'Condiviso' : 'Condividi'}
              </button>
            )}
            <span className={`ticket-status ${ticket.status}`}>
              {ticket.status === 'won' ? 'Vinto' : ticket.status === 'lost' ? 'Perso' : 'In attesa'}
            </span>
          </div>
        </div>

        {matchGroups.map((group, gi) => (
          <div key={gi} className="match-group">
            {/* Header evento: data - sport - competizione */}
            {(group.sport || group.competition) && (
              <div style={{ fontSize: '0.75rem', color: '#546e7a', marginBottom: '0.2rem' }}>
                {group.eventDate && new Date(group.eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                {group.sport && <span> - {group.sport}</span>}
                {group.competition && <span> - {group.competition}</span>}
              </div>
            )}
            {/* Nome partita con eventuale punteggio */}
            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', fontSize: '0.95rem' }}>
              {group.match}
              {group.score && (
                <span style={{ marginLeft: '0.5rem', color: '#ffb74d', fontWeight: 'normal', fontSize: '0.85rem' }}>
                  ({group.score})
                </span>
              )}
            </div>
            {/* Scommesse della partita */}
            {group.bets.map((bet, bi) => (
              <div key={bi} className="bet-item">
                <span style={{ color: '#e0e0e0' }}>{bet.prediction}</span>
                {bet.selection && (
                  <span style={{
                    marginLeft: '0.5rem',
                    background: bet.selection === 'SI' ? '#1b5e20' : '#b71c1c',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: 'white',
                    fontWeight: 'bold',
                  }}>
                    {bet.selection}
                  </span>
                )}
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
                  <span style={{ marginLeft: '0.5rem', color: '#ffb74d', fontSize: '0.85rem', fontWeight: 'bold' }}>
                    {bet.odds.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}

        {(ticket.stake || ticket.potentialWin || ticket.totalOdds) && (
          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #2a3a4a', fontSize: '0.85rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {ticket.stake != null && <span>Puntata: <strong>{ticket.stake.toFixed(2)}&euro;</strong></span>}
            {ticket.totalOdds != null && <span style={{ color: '#ffb74d' }}>Quota: {ticket.totalOdds.toFixed(2)}</span>}
            {ticket.potentialWin != null && <span style={{ color: '#66bb6a' }}>Vincita: <strong>{ticket.potentialWin.toFixed(2)}&euro;</strong></span>}
          </div>
        )}
      </div>
    );
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
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            className="btn-small"
            style={{ background: tab === 'my' ? '#4fc3f7' : '#37474f', color: tab === 'my' ? '#0f1923' : 'white' }}
            onClick={() => setTab('my')}
          >
            I miei Ticket ({tickets.length})
          </button>
          <button
            className="btn-small"
            style={{ background: tab === 'shared' ? '#4fc3f7' : '#37474f', color: tab === 'shared' ? '#0f1923' : 'white' }}
            onClick={() => { setTab('shared'); loadShared(); }}
          >
            Ticket Condivisi ({sharedTickets.length})
          </button>
        </div>

        {tab === 'my' && (
          <>
            {tickets.length === 0 && (
              <p style={{ color: '#78909c', marginTop: '0.5rem' }}>Nessun ticket caricato ancora.</p>
            )}
            {tickets.map((ticket) => renderTicketCard(ticket, false))}
          </>
        )}

        {tab === 'shared' && (
          <>
            {sharedTickets.length === 0 && (
              <p style={{ color: '#78909c', marginTop: '0.5rem' }}>Nessun ticket condiviso dai player.</p>
            )}
            {sharedTickets.map((ticket) => renderTicketCard(ticket, true))}
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
