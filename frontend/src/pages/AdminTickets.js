import React, { useState, useEffect } from 'react';
import { getAllTickets, updateTicketStatus, editTicket, deleteTicket } from '../services/api';

function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const res = await getAllTickets();
      setTickets(res.data);
    } catch (err) {
      console.error('Errore caricamento ticket:', err);
    }
  };

  const showMsg = (msg, isError) => {
    if (isError) { setError(msg); setMessage(''); }
    else { setMessage(msg); setError(''); }
    setTimeout(() => { setMessage(''); setError(''); }, 4000);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateTicketStatus(id, status);
      showMsg('Stato aggiornato.', false);
      loadTickets();
    } catch (err) {
      showMsg('Errore aggiornamento stato.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo ticket?')) return;
    try {
      await deleteTicket(id);
      showMsg('Ticket eliminato.', false);
      if (expanded === id) setExpanded(null);
      loadTickets();
    } catch (err) {
      showMsg('Errore eliminazione.', true);
    }
  };

  const handleExpand = (id) => {
    setExpanded(expanded === id ? null : id);
    setEditing(null);
  };

  const startEdit = (ticket) => {
    setEditing(ticket._id);
    setEditForm({
      stake: ticket.stake || '',
      potentialWin: ticket.potentialWin || '',
      totalOdds: ticket.totalOdds || '',
      bets: ticket.bets.map((b) => ({
        match: b.match,
        prediction: b.prediction,
        selection: b.selection || '',
        betType: b.betType || 'N/D',
        odds: b.odds || '',
        eventDate: b.eventDate ? new Date(b.eventDate).toISOString().split('T')[0] : '',
      })),
    });
  };

  const handleEditBet = (index, field, value) => {
    const newBets = [...editForm.bets];
    newBets[index] = { ...newBets[index], [field]: value };
    setEditForm({ ...editForm, bets: newBets });
  };

  const handleSaveEdit = async (id) => {
    try {
      const data = {
        stake: editForm.stake ? parseFloat(editForm.stake) : null,
        potentialWin: editForm.potentialWin ? parseFloat(editForm.potentialWin) : null,
        totalOdds: editForm.totalOdds ? parseFloat(editForm.totalOdds) : null,
        bets: editForm.bets.map((b) => ({
          match: b.match,
          prediction: b.prediction,
          selection: b.selection || '',
          betType: b.betType,
          odds: b.odds ? parseFloat(b.odds) : undefined,
          eventDate: b.eventDate || undefined,
        })),
      };
      await editTicket(id, data);
      setEditing(null);
      showMsg('Ticket aggiornato.', false);
      loadTickets();
    } catch (err) {
      showMsg('Errore salvataggio.', true);
    }
  };

  const statusLabel = (s) => s === 'won' ? 'Vinto' : s === 'lost' ? 'Perso' : 'In attesa';
  const statusColor = (s) => s === 'won' ? '#4caf50' : s === 'lost' ? '#f44336' : '#ff9800';

  return (
    <div className="admin-page">
      <h2>Gestione Ticket ({tickets.length})</h2>

      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Data caricamento</th>
              <th>ID Ticket</th>
              <th>N. Eventi</th>
              <th>Player</th>
              <th>Puntata</th>
              <th>Stato</th>
              <th>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <React.Fragment key={ticket._id}>
                <tr
                  style={{ cursor: 'pointer', background: expanded === ticket._id ? '#263238' : 'transparent' }}
                  onClick={() => handleExpand(ticket._id)}
                >
                  <td>
                    {new Date(ticket.createdAt).toLocaleDateString('it-IT', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    {ticket.ticketId ? ticket.ticketId.substring(0, 16) + (ticket.ticketId.length > 16 ? '...' : '') : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{ticket.bets.length}</td>
                  <td style={{ color: '#4fc3f7' }}>{ticket.user?.alias || ticket.user?.email || 'N/D'}</td>
                  <td>{ticket.stake ? ticket.stake.toFixed(2) + '\u20AC' : '-'}</td>
                  <td>
                    <span style={{
                      color: statusColor(ticket.status), fontWeight: 'bold', fontSize: '0.85rem',
                    }}>
                      {statusLabel(ticket.status)}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      <button className="btn-small btn-success" style={{ fontSize: '0.7rem' }} onClick={() => handleStatusChange(ticket._id, 'won')}>V</button>
                      <button className="btn-small btn-danger" style={{ fontSize: '0.7rem' }} onClick={() => handleStatusChange(ticket._id, 'lost')}>P</button>
                      <button className="btn-small btn-warning" style={{ fontSize: '0.7rem' }} onClick={() => handleStatusChange(ticket._id, 'pending')}>A</button>
                      <button className="btn-small" style={{ fontSize: '0.7rem', background: '#b71c1c', color: 'white' }} onClick={() => handleDelete(ticket._id)}>X</button>
                    </div>
                  </td>
                </tr>

                {expanded === ticket._id && (
                  <tr>
                    <td colSpan="7" style={{ padding: '1rem', background: '#1e2d3a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ color: '#4fc3f7', margin: 0 }}>Dettaglio Ticket</h4>
                        {editing !== ticket._id ? (
                          <button className="btn-small" style={{ background: '#4fc3f7', color: '#0f1923', fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); startEdit(ticket); }}>
                            Modifica
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-small btn-success" style={{ fontSize: '0.8rem' }} onClick={(e) => { e.stopPropagation(); handleSaveEdit(ticket._id); }}>Salva</button>
                            <button className="btn-small" style={{ fontSize: '0.8rem', background: '#546e7a', color: 'white' }} onClick={(e) => { e.stopPropagation(); setEditing(null); }}>Annulla</button>
                          </div>
                        )}
                      </div>

                      {/* Info generali */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        <div>
                          <span style={{ color: '#78909c' }}>Player: </span>
                          <strong style={{ color: '#4fc3f7' }}>{ticket.user?.alias || 'N/D'}</strong>
                          {ticket.user?.email && <span style={{ color: '#546e7a', marginLeft: '0.5rem' }}>({ticket.user.email})</span>}
                        </div>
                        <div>
                          <span style={{ color: '#78909c' }}>ID: </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{ticket.ticketId || '-'}</span>
                        </div>
                        {editing !== ticket._id ? (
                          <>
                            <div><span style={{ color: '#78909c' }}>Puntata: </span><strong>{ticket.stake ? ticket.stake.toFixed(2) + '\u20AC' : '-'}</strong></div>
                            <div><span style={{ color: '#78909c' }}>Quota tot: </span><span style={{ color: '#ffb74d' }}>{ticket.totalOdds ? ticket.totalOdds.toFixed(2) : '-'}</span></div>
                            <div><span style={{ color: '#78909c' }}>Vincita pot: </span><span style={{ color: '#66bb6a' }}><strong>{ticket.potentialWin ? ticket.potentialWin.toFixed(2) + '\u20AC' : '-'}</strong></span></div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span style={{ color: '#78909c' }}>Puntata: </span>
                              <input type="number" step="0.01" value={editForm.stake} onChange={(e) => setEditForm({ ...editForm, stake: e.target.value })}
                                style={{ width: '80px', padding: '0.2rem', background: '#263238', border: '1px solid #4fc3f7', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                            <div>
                              <span style={{ color: '#78909c' }}>Quota tot: </span>
                              <input type="number" step="0.01" value={editForm.totalOdds} onChange={(e) => setEditForm({ ...editForm, totalOdds: e.target.value })}
                                style={{ width: '80px', padding: '0.2rem', background: '#263238', border: '1px solid #4fc3f7', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                            <div>
                              <span style={{ color: '#78909c' }}>Vincita pot: </span>
                              <input type="number" step="0.01" value={editForm.potentialWin} onChange={(e) => setEditForm({ ...editForm, potentialWin: e.target.value })}
                                style={{ width: '80px', padding: '0.2rem', background: '#263238', border: '1px solid #4fc3f7', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Scommesse */}
                      <h5 style={{ color: '#b0bec5', marginBottom: '0.5rem' }}>Scommesse ({ticket.bets.length})</h5>
                      {editing !== ticket._id ? (
                        ticket.bets.map((bet, i) => (
                          <div key={i} className="bet-item" style={{ marginBottom: '0.3rem' }}>
                            <strong>{bet.match}</strong> - <span style={{ color: '#4fc3f7' }}>{bet.prediction}</span>
                            {bet.betType && bet.betType !== 'N/D' && (
                              <span style={{ marginLeft: '0.5rem', background: '#1a3a4a', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', color: '#80cbc4' }}>
                                {bet.betType}
                              </span>
                            )}
                            {bet.odds && <span style={{ marginLeft: '0.5rem', color: '#ffb74d', fontSize: '0.8rem' }}>@{bet.odds.toFixed(2)}</span>}
                            {bet.eventDate && <span style={{ color: '#78909c', marginLeft: '0.5rem', fontSize: '0.8rem' }}>({new Date(bet.eventDate).toLocaleDateString('it-IT')})</span>}
                          </div>
                        ))
                      ) : (
                        editForm.bets.map((bet, i) => (
                          <div key={i} style={{ background: '#263238', padding: '0.8rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div>
                              <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Partita</label>
                              <input value={bet.match} onChange={(e) => handleEditBet(i, 'match', e.target.value)}
                                style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                            <div>
                              <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Pronostico</label>
                              <input value={bet.prediction} onChange={(e) => handleEditBet(i, 'prediction', e.target.value)}
                                style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                            <div>
                              <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Tipo scommessa</label>
                              <input value={bet.betType} onChange={(e) => handleEditBet(i, 'betType', e.target.value)}
                                style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <div style={{ flex: 1 }}>
                                <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Scelta</label>
                                <select value={bet.selection || ''} onChange={(e) => handleEditBet(i, 'selection', e.target.value)}
                                  style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }}>
                                  <option value="">--</option>
                                  <option value="SI">SI</option>
                                  <option value="NO">NO</option>
                                  <option value="1">1</option>
                                  <option value="X">X</option>
                                  <option value="2">2</option>
                                  <option value="1X">1X</option>
                                  <option value="X2">X2</option>
                                  <option value="12">12</option>
                                  <option value="OVER">OVER</option>
                                  <option value="UNDER">UNDER</option>
                                  <option value="GOAL">GOAL</option>
                                  <option value="NO GOAL">NO GOAL</option>
                                  <option value="GG">GG</option>
                                  <option value="NG">NG</option>
                                  <option value="PARI">PARI</option>
                                  <option value="DISPARI">DISPARI</option>
                                </select>
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Quota</label>
                                <input type="number" step="0.01" value={bet.odds} onChange={(e) => handleEditBet(i, 'odds', e.target.value)}
                                  style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label style={{ color: '#78909c', fontSize: '0.75rem' }}>Data evento</label>
                                <input type="date" value={bet.eventDate} onChange={(e) => handleEditBet(i, 'eventDate', e.target.value)}
                                  style={{ width: '100%', padding: '0.3rem', background: '#1a2530', border: '1px solid #37474f', color: '#e0e0e0', borderRadius: '3px' }} />
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      {/* OCR raw */}
                      {ticket.ocrRawText && ticket.ocrRawText !== 'OCR non disponibile' && (
                        <details style={{ marginTop: '1rem' }}>
                          <summary style={{ color: '#78909c', cursor: 'pointer', fontSize: '0.85rem' }}>Testo OCR grezzo</summary>
                          <pre style={{ background: '#0f1923', padding: '0.8rem', borderRadius: '4px', fontSize: '0.75rem', color: '#78909c', whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                            {ticket.ocrRawText}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {tickets.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#78909c', padding: '2rem' }}>Nessun ticket caricato</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminTickets;
