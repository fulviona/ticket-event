import React, { useState, useEffect } from 'react';
import { getBachecaUsers, getBachecaUserTickets } from '../services/api';

function Bacheca() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getBachecaUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Errore caricamento bacheca:', err);
    }
  };

  const handleUserClick = async (user) => {
    if (selectedUser?.userId === user.userId) {
      setSelectedUser(null);
      setTickets([]);
      return;
    }
    setSelectedUser(user);
    setLoadingTickets(true);
    try {
      const res = await getBachecaUserTickets(user.userId);
      setTickets(res.data);
    } catch (err) {
      console.error('Errore caricamento ticket:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  return (
    <div>
      <div className="bacheca-header">
        <h2>Bacheca</h2>
        <p style={{ color: '#78909c', marginTop: '0.5rem' }}>
          Scopri i ticket condivisi dai player della community
        </p>
      </div>

      <div className="bacheca-users-list">
        {users.length === 0 && (
          <p style={{ color: '#78909c', textAlign: 'center', padding: '2rem' }}>
            Nessun player ha ancora condiviso ticket.
          </p>
        )}
        {users.map((u) => (
          <div
            key={u.userId}
            className={`bacheca-user-card ${selectedUser?.userId === u.userId ? 'active' : ''}`}
            onClick={() => handleUserClick(u)}
          >
            <div className="bacheca-user-info">
              {u.avatar ? (
                <img src={u.avatar} alt="" className="bacheca-avatar" />
              ) : (
                <div className="bacheca-avatar-placeholder">
                  {u.alias?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div>
                <span className="bacheca-alias">{u.alias}</span>
                <span className="bacheca-points">{u.points} pt</span>
              </div>
            </div>
            <span className="bacheca-ticket-count">
              {u.ticketCount} ticket
            </span>
          </div>
        ))}
      </div>

      {selectedUser && (
        <div className="bacheca-tickets-section">
          <h3 style={{ color: '#4fc3f7', marginBottom: '1rem' }}>
            Ticket condivisi da {selectedUser.alias}
          </h3>

          {loadingTickets && (
            <p style={{ color: '#78909c' }}>Caricamento...</p>
          )}

          {!loadingTickets && tickets.length === 0 && (
            <p style={{ color: '#78909c' }}>Nessun ticket condiviso.</p>
          )}

          {tickets.map((ticket) => {
            // Raggruppa scommesse per partita
            const groups = [];
            let currentGroup = null;
            for (const bet of ticket.bets) {
              if (!currentGroup || currentGroup.match !== bet.match) {
                currentGroup = { match: bet.match, sport: bet.sport || '', competition: bet.competition || '', score: bet.score || '', eventDate: bet.eventDate, bets: [] };
                groups.push(currentGroup);
              }
              currentGroup.bets.push(bet);
            }

            return (
              <div key={ticket._id} className={`ticket-card ${ticket.status}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#78909c', fontSize: '0.85rem' }}>
                    {new Date(ticket.playedAt || ticket.createdAt).toLocaleDateString('it-IT', {
                      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                  <span className={`ticket-status ${ticket.status}`}>
                    {ticket.status === 'won' ? 'Vinto' : ticket.status === 'lost' ? 'Perso' : 'In attesa'}
                  </span>
                </div>

                {groups.map((group, gi) => (
                  <div key={gi} className="match-group">
                    <div style={{ fontSize: '0.75rem', color: '#546e7a', marginBottom: '0.3rem' }}>
                      {group.eventDate && new Date(group.eventDate).toLocaleDateString('it-IT', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                      {group.sport && <span> - {group.sport}</span>}
                      {group.competition && <span> - {group.competition}</span>}
                    </div>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1rem' }}>
                      {group.match}
                      {group.score && (
                        <span style={{ marginLeft: '0.5rem', color: '#ffb74d', fontWeight: 'normal', fontSize: '0.9rem' }}>({group.score})</span>
                      )}
                    </div>
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
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                {bet.player && (
                                  <span style={{ color: '#4fc3f7', fontWeight: 'bold', fontSize: '0.85rem' }}>{bet.player}</span>
                                )}
                                <span style={{ color: '#e0e0e0', fontSize: '0.82rem' }}>{bet.prediction}</span>
                                {bet.betType && bet.betType !== 'N/D' && (
                                  <span style={{
                                    display: 'inline-block', width: 'fit-content',
                                    background: '#1a3a4a', padding: '0.1rem 0.4rem',
                                    borderRadius: '4px', fontSize: '0.7rem', color: '#80cbc4',
                                  }}>{bet.betType}</span>
                                )}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {bet.selection && (
                                <span style={{
                                  background: bet.selection === 'SI' ? '#1b5e20' : bet.selection === 'NO' ? '#b71c1c' : '#37474f',
                                  padding: '0.2rem 0.6rem', borderRadius: '4px',
                                  fontSize: '0.8rem', color: 'white', fontWeight: 'bold',
                                }}>{bet.selection}</span>
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
                ))}

                {ticket.totalOdds && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #2a3a4a', fontSize: '0.85rem' }}>
                    <span style={{ color: '#ffb74d' }}>Quota totale: {ticket.totalOdds.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Bacheca;
