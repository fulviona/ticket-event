import React, { useState, useEffect } from 'react';
import { getLeaderboard } from '../services/api';

function Leaderboard() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getLeaderboard()
      .then((res) => setUsers(res.data))
      .catch((err) => console.error('Errore caricamento classifica:', err));
  }, []);

  return (
    <div className="leaderboard">
      <h2>Classifica</h2>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Utente</th>
            <th>Punti</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => (
            <tr key={user._id}>
              <td className={index < 3 ? `rank-${index + 1}` : ''}>
                {index + 1}
              </td>
              <td>{user.email}</td>
              <td style={{ fontWeight: 'bold', color: '#4fc3f7' }}>{user.points}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan="3" style={{ textAlign: 'center', color: '#78909c', padding: '2rem' }}>
                Nessun utente in classifica
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;
