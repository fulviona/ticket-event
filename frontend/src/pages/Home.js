import React, { useState, useEffect, useRef } from 'react';
import { uploadTicket, getMyTickets, getSharedTickets, toggleShareTicket, reparseTicket, importTicketUrl, importTicketText } from '../services/api';
import { sanitizeTicketUrlInput } from '../utils/ticketUrl';

function Home({ user }) {
  const [tickets, setTickets] = useState([]);
  const [sharedTickets, setSharedTickets] = useState([]);
  const [tab, setTab] = useState('my');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');
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
      const issues = err.response?.data?.issues;
      if (issues && issues.length > 0) {
        setError(err.response.data.message + '\n' + issues.join('\n'));
      } else {
        setError(err.response?.data?.message || 'Errore durante il caricamento.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleImportUrl = async () => {
    if (!ticketUrl.trim()) return;
    const cleanedUrl = sanitizeTicketUrlInput(ticketUrl);
    if (!cleanedUrl) return;
    setImportingUrl(true);
    setError('');
    setMessage('');
    setShowPasteBox(false);
    try {
      await importTicketUrl(cleanedUrl);
      setMessage('Ticket importato dal link con successo!');
      setTicketUrl('');
      loadTickets();
    } catch (err) {
      const needsPaste = err.response?.data?.needsClientFetch;
      if ((err.response?.status === 403 || err.response?.status === 422) && needsPaste) {
        setShowPasteBox(true);
        setError(
          err.response?.data?.message ||
            'Apri il ticket nel browser, copia tutto il testo della pagina e incollalo qui sotto.',
        );
      } else {
        const issues = err.response?.data?.issues;
        if (issues && issues.length > 0) {
          setError(err.response.data.message + '\n' + issues.join('\n'));
        } else {
          setError(err.response?.data?.message || 'Errore durante l\'importazione dal link.');
        }
      }
    } finally {
      setImportingUrl(false);
    }
  };

  const handlePasteImport = async () => {
    if (!pasteText.trim() || pasteText.trim().length < 20) {
      setError('Incolla il testo completo della pagina del ticket.');
      return;
    }
    setImportingUrl(true);
    setError('');
    setMessage('');
    try {
      await importTicketText(pasteText.trim(), sanitizeTicketUrlInput(ticketUrl) || undefined);
      setMessage('Ticket importato con successo!');
      setTicketUrl('');
      setPasteText('');
      setShowPasteBox(false);
      loadTickets();
    } catch (err) {
      const issues = err.response?.data?.issues;
      if (issues && issues.length > 0) {
        setError(err.response.data.message + '\n' + issues.join('\n'));
      } else {
        setError(err.response?.data?.message || 'Errore durante l\'importazione.');
      }
    } finally {
      setImportingUrl(false);
    }
  };

  const handleReparse = async (id) => {
    try {
      const res = await reparseTicket(id);
      const issues = res.data?.issues;
      if (issues && issues.length > 0) {
        setMessage(res.data.message);
        setError('Campi incompleti:\n' + issues.join('\n'));
      } else {
        setMessage('Ticket ri-analizzato con successo!');
      }
      loadTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante la ri-analisi.');
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
        <div className="ticket-card__header">
          <div className="ticket-card__meta">
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
              <span className="ticket-card__id">
                ID: {ticket.ticketId.substring(0, 12)}...
              </span>
            )}
            {ticket.concessionario && (
              <span className="ticket-card__concessionario">
                {ticket.concessionario}
              </span>
            )}
          </div>
          <div className="ticket-card__actions">
            {!showUser && (
              <>
                <button
                  type="button"
                  className="btn-small ticket-card__btn-action"
                  style={{ background: '#37474f', color: '#90a4ae' }}
                  onClick={() => handleReparse(ticket._id)}
                  title="Ri-analizza il ticket con il parser aggiornato"
                >
                  Ri-analizza
                </button>
                <button
                  type="button"
                  className="btn-small ticket-card__btn-action"
                  style={{
                    background: ticket.shared ? '#2e7d32' : '#37474f',
                    color: 'white',
                  }}
                  onClick={() => handleShare(ticket._id)}
                  title={ticket.shared ? 'Clicca per nascondere' : 'Clicca per condividere'}
                >
                  {ticket.shared ? 'Condiviso' : 'Condividi'}
                </button>
              </>
            )}
            <span className={`ticket-status ${ticket.status}`}>
              {ticket.status === 'won' ? 'Vinto' : ticket.status === 'lost' ? 'Perso' : 'In attesa'}
            </span>
          </div>
        </div>

        {matchGroups.map((group, gi) => (
          <div key={gi} className="match-group">
            {/* Header evento: data/ora - sport - competizione */}
            <div style={{ fontSize: '0.75rem', color: '#546e7a', marginBottom: '0.3rem' }}>
              {group.eventDate && new Date(group.eventDate).toLocaleDateString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
              {group.sport && <span> - {group.sport}</span>}
              {group.competition && <span> - {group.competition}</span>}
            </div>
            {/* Nome partita */}
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1rem' }}>
              {group.match}
            </div>
            {/* Tabella scommesse della partita */}
            <div className="table-responsive">
            <table className="bet-table">
              <thead>
                <tr>
                  <th style={{ width: '55%' }}>Tipo Scommessa</th>
                  <th style={{ width: '25%', textAlign: 'center' }}>Scelta</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Quota</th>
                </tr>
              </thead>
              <tbody>
                {group.bets.map((bet, bi) => (
                  <tr key={bi} className="bet-row">
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {bet.player && (
                          <span style={{ color: '#4fc3f7', fontWeight: 'bold', fontSize: '0.85rem' }}>
                            {bet.player}
                          </span>
                        )}
                        <span style={{ color: '#e0e0e0', fontSize: '0.82rem' }}>
                          {bet.prediction}
                        </span>
                        {bet.betType && bet.betType !== 'N/D' && (
                          <span style={{
                            display: 'inline-block',
                            width: 'fit-content',
                            background: '#1a3a4a',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: '#80cbc4',
                            marginTop: '0.1rem',
                          }}>
                            {bet.betType}
                          </span>
                        )}
{/* settlementInfo conservato nei dati per refertazione interna, non visibile al player */}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      {bet.selection && (
                        <span style={{
                          background: bet.result === 'won' ? '#1b5e20' : bet.result === 'lost' ? '#b71c1c' : '#455a64',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          color: 'white',
                          fontWeight: 'bold',
                        }}>
                          {bet.selection}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                      {bet.odds && (
                        <span style={{ color: '#ffb74d', fontSize: '0.95rem', fontWeight: 'bold' }}>
                          {bet.odds.toFixed(2)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
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
      {importingUrl && (
        <div className="import-loading-overlay">
          <div className="import-spinner"></div>
          <div className="import-loading-text">Importazione in corso...<br/>Potrebbe richiedere qualche secondo</div>
        </div>
      )}
      <div className="upload-section">
        <h2>Carica il tuo Ticket</h2>
        <p style={{ color: '#78909c', marginBottom: '1rem' }}>
          Scatta una foto della tua scommessa e il sistema la leggera automaticamente
        </p>

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

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

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a3a4a' }}>
          <p style={{ color: '#78909c', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Oppure incolla il link di condivisione del ticket
          </p>
          <div className="home-url-import-row">
            <input
              type="url"
              placeholder="https://sportium.it/sport/ticket/..."
              value={ticketUrl}
              onChange={(e) => setTicketUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleImportUrl()}
              className="home-url-import-input"
            />
            <button
              type="button"
              className="btn-primary home-url-import-btn"
              onClick={handleImportUrl}
              disabled={!ticketUrl.trim() || importingUrl}
            >
              {importingUrl ? 'Importo...' : 'Importa'}
            </button>
          </div>
          {showPasteBox && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: '#ffb74d', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Apri il link nel browser, seleziona tutto il testo (Ctrl+A), copialo (Ctrl+C) e incollalo qui:
              </p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Incolla qui il testo copiato dalla pagina del ticket..."
                rows={6}
                style={{
                  width: '100%',
                  background: '#1a2332',
                  color: 'white',
                  border: '1px solid #37474f',
                  borderRadius: '8px',
                  padding: '0.8rem',
                  fontSize: '0.9rem',
                  resize: 'vertical',
                }}
              />
              <button
                className="btn-primary"
                style={{ marginTop: '0.5rem', padding: '0.6rem 1.5rem' }}
                onClick={handlePasteImport}
                disabled={!pasteText.trim() || importingUrl}
              >
                {importingUrl ? 'Importo...' : 'Importa testo'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tickets-section">
        <div className="tickets-tabs">
          <button
            type="button"
            className="btn-small"
            style={{ background: tab === 'my' ? '#4fc3f7' : '#37474f', color: tab === 'my' ? '#0f1923' : 'white' }}
            onClick={() => setTab('my')}
          >
            I miei Ticket ({tickets.length})
          </button>
          <button
            type="button"
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
