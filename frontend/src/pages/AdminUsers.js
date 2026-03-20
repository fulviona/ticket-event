import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../services/api';

function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAllUsers()
      .then((res) => setUsers(res.data))
      .catch((err) => console.error('Errore caricamento utenti:', err));
  }, []);

  return (
    <div className="admin-page">
      <h2>Gestione Utenti ({users.length})</h2>
      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Telefono</th>
              <th>Data nascita</th>
              <th>Punti</th>
              <th>Newsletter</th>
              <th>Ruolo</th>
              <th>Registrato il</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id}>
                <td>{user.email}</td>
                <td>{user.phone}</td>
                <td>{new Date(user.dateOfBirth).toLocaleDateString('it-IT')}</td>
                <td style={{ fontWeight: 'bold', color: '#4fc3f7' }}>{user.points}</td>
                <td>{user.newsletterConsent ? 'Si' : 'No'}</td>
                <td>{user.role}</td>
                <td>{new Date(user.createdAt).toLocaleDateString('it-IT')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminUsers;
