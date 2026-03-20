import React, { useState, useRef } from 'react';
import { updateProfile } from '../services/api';

function Profile({ user, setUser }) {
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [newsletter, setNewsletter] = useState(user?.newsletterConsent || false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Le nuove password non corrispondono.');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setError('La nuova password deve avere almeno 6 caratteri.');
      return;
    }

    setLoading(true);
    try {
      const res = await updateProfile({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setMessage('Password aggiornata con successo!');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      if (res.data.user) setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Errore aggiornamento password.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewsletterToggle = async () => {
    try {
      const newVal = !newsletter;
      const res = await updateProfile({ newsletterConsent: newVal });
      setNewsletter(newVal);
      setMessage(newVal ? 'Newsletter attivata!' : 'Newsletter disattivata.');
      if (res.data.user) setUser(res.data.user);
    } catch (err) {
      setError('Errore aggiornamento newsletter.');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setError('Immagine troppo grande. Max 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setAvatarPreview(base64);
      setError('');
      try {
        const res = await updateProfile({ avatar: base64 });
        setMessage('Foto profilo aggiornata!');
        if (res.data.user) setUser(res.data.user);
      } catch (err) {
        setError(err.response?.data?.message || 'Errore caricamento foto.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      const res = await updateProfile({ avatar: null });
      setAvatarPreview(null);
      setMessage('Foto profilo rimossa.');
      if (res.data.user) setUser(res.data.user);
    } catch (err) {
      setError('Errore rimozione foto.');
    }
  };

  return (
    <div className="form-container" style={{ maxWidth: '600px' }}>
      <h2>Profilo</h2>

      {message && <div className="success-msg">{message}</div>}
      {error && <div className="error-msg">{error}</div>}

      {/* Info utente */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: '#263238',
            margin: '0 auto 1rem',
            overflow: 'hidden',
            cursor: 'pointer',
            border: '3px solid #4fc3f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => fileRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '2.5rem', color: '#4fc3f7' }}>
              {user?.alias?.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarChange}
          ref={fileRef}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button className="btn-small" style={{ background: '#4fc3f7', color: '#0f1923' }} onClick={() => fileRef.current?.click()}>
            Cambia foto
          </button>
          {avatarPreview && (
            <button className="btn-small btn-danger" onClick={handleRemoveAvatar}>
              Rimuovi
            </button>
          )}
        </div>
        <p style={{ color: '#4fc3f7', fontSize: '1.2rem', fontWeight: 'bold', marginTop: '0.8rem' }}>
          {user?.alias}
        </p>
        <p style={{ color: '#78909c', fontSize: '0.85rem' }}>{user?.email}</p>
        <p style={{ color: '#81c784', fontSize: '0.9rem', marginTop: '0.3rem' }}>{user?.points || 0} punti</p>
      </div>

      {/* Cambio password */}
      <div style={{ borderTop: '1px solid #37474f', paddingTop: '1.5rem', marginTop: '1rem' }}>
        <h3 style={{ color: '#4fc3f7', marginBottom: '1rem', fontSize: '1rem' }}>Cambia Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label>Password attuale</label>
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Nuova password</label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label>Conferma nuova password</label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Aggiornamento...' : 'Aggiorna Password'}
          </button>
        </form>
      </div>

      {/* Newsletter */}
      <div style={{ borderTop: '1px solid #37474f', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
        <h3 style={{ color: '#4fc3f7', marginBottom: '1rem', fontSize: '1rem' }}>Preferenze</h3>
        <div className="checkbox-group" style={{ cursor: 'pointer' }} onClick={handleNewsletterToggle}>
          <input type="checkbox" checked={newsletter} readOnly />
          <label style={{ cursor: 'pointer' }}>Ricevi newsletter e comunicazioni promozionali</label>
        </div>
      </div>
    </div>
  );
}

export default Profile;
