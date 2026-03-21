import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUserAlias, toggleBlockUser, deleteUser, sendTempPassword, exportUsersExcel } from '../services/api';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [editingAlias, setEditingAlias] = useState(null);
  const [aliasValue, setAliasValue] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tempPwModal, setTempPwModal] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await getAllUsers();
      setUsers(res.data);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
    }
  };

  const showMsg = (msg, isError) => {
    if (isError) { setError(msg); setMessage(''); }
    else { setMessage(msg); setError(''); }
    setTimeout(() => { setMessage(''); setError(''); }, 4000);
  };

  const handleEditAlias = (user) => {
    setEditingAlias(user._id);
    setAliasValue(user.alias || '');
  };

  const handleSaveAlias = async (id) => {
    try {
      await updateUserAlias(id, aliasValue);
      setEditingAlias(null);
      showMsg('Alias aggiornato!', false);
      loadUsers();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Errore aggiornamento alias.', true);
    }
  };

  const handleBlock = async (id) => {
    try {
      const res = await toggleBlockUser(id);
      showMsg(res.data.message, false);
      loadUsers();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Errore.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo utente e tutti i suoi ticket?')) return;
    try {
      await deleteUser(id);
      showMsg('Utente eliminato.', false);
      loadUsers();
    } catch (err) {
      showMsg(err.response?.data?.message || 'Errore eliminazione.', true);
    }
  };

  const handleTempPassword = async (id) => {
    try {
      const res = await sendTempPassword(id);
      setTempPwModal(res.data.tempPassword);
    } catch (err) {
      showMsg(err.response?.data?.message || 'Errore.', true);
    }
  };

  const handleExport = async () => {
    try {
      const res = await exportUsersExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'utenti.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showMsg('Errore download.', true);
    }
  };

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Gestione Utenti ({users.length})</h2>
        <button className="btn-small btn-success" onClick={handleExport} style={{ padding: '0.5rem 1rem' }}>
          Scarica Excel (CSV)
        </button>
      </div>

      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      {tempPwModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: '#1a2530', padding: '2rem', borderRadius: '8px', textAlign: 'center', maxWidth: '400px' }}>
            <h3 style={{ color: '#4fc3f7', marginBottom: '1rem' }}>Password Provvisoria</h3>
            <p style={{ color: '#78909c', marginBottom: '1rem' }}>Comunica questa password all'utente:</p>
            <div style={{
              background: '#263238', padding: '1rem', borderRadius: '4px',
              fontFamily: 'monospace', fontSize: '1.5rem', color: '#66bb6a', letterSpacing: '2px',
              userSelect: 'all', marginBottom: '1rem',
            }}>
              {tempPwModal}
            </div>
            <p style={{ color: '#ef5350', fontSize: '0.85rem', marginBottom: '1rem' }}>
              L'utente dovra' cambiarla dal profilo al primo accesso.
            </p>
            <button className="btn-primary" style={{ maxWidth: '200px' }} onClick={() => setTempPwModal(null)}>
              Chiudi
            </button>
          </div>
        </div>
      )}

      <div className="admin-users-list">
        {users.map((user) => (
          <div key={user._id} className="admin-user-card" style={{ opacity: user.blocked ? 0.5 : 1 }}>
            <div className="admin-user-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                {editingAlias === user._id ? (
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={aliasValue}
                      onChange={(e) => setAliasValue(e.target.value)}
                      style={{ width: '120px', padding: '0.3rem', background: '#263238', border: '1px solid #4fc3f7', color: '#e0e0e0', borderRadius: '3px', fontSize: '0.85rem' }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveAlias(user._id)}
                    />
                    <button className="btn-small btn-success" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleSaveAlias(user._id)}>OK</button>
                    <button className="btn-small" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#546e7a', color: 'white' }} onClick={() => setEditingAlias(null)}>X</button>
                  </div>
                ) : (
                  <span
                    style={{ cursor: 'pointer', color: user.alias ? '#4fc3f7' : '#ef5350', textDecoration: 'underline dotted', fontWeight: 'bold', fontSize: '1rem' }}
                    onClick={() => handleEditAlias(user)}
                    title="Clicca per modificare alias"
                  >
                    {user.alias || 'Nessun alias'}
                  </span>
                )}
                <span style={{ color: '#78909c', fontSize: '0.8rem' }}>({user.role})</span>
                {user.blocked ? (
                  <span style={{ color: '#ef5350', fontSize: '0.75rem', fontWeight: 'bold', background: '#3e1111', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Bloccato</span>
                ) : (
                  <span style={{ color: '#66bb6a', fontSize: '0.75rem', background: '#112211', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Attivo</span>
                )}
              </div>
              <span style={{ fontWeight: 'bold', color: '#4fc3f7', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{user.points} pt</span>
            </div>
            <div className="admin-user-card-details">
              <span title={user.email} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
              <span>{user.phone}</span>
              <span>Nato: {new Date(user.dateOfBirth).toLocaleDateString('it-IT')}</span>
              <span>Reg: {new Date(user.createdAt).toLocaleDateString('it-IT')}</span>
              <span>NL: {user.newsletterConsent ? 'Si' : 'No'}</span>
            </div>
            {user.role !== 'admin' && (
              <div className="admin-user-card-actions">
                <button
                  className="btn-small"
                  style={{ background: user.blocked ? '#66bb6a' : '#ff9800', color: 'white', fontSize: '0.75rem' }}
                  onClick={() => handleBlock(user._id)}
                >
                  {user.blocked ? 'Sblocca' : 'Blocca'}
                </button>
                <button
                  className="btn-small"
                  style={{ background: '#7b1fa2', color: 'white', fontSize: '0.75rem' }}
                  onClick={() => handleTempPassword(user._id)}
                >
                  Password temp.
                </button>
                <button
                  className="btn-small btn-danger"
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => handleDelete(user._id)}
                >
                  Elimina
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminUsers;
