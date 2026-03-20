import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../services/api';

function Register({ setUser }) {
  const [form, setForm] = useState({
    alias: '',
    email: '',
    password: '',
    phone: '',
    dateOfBirth: '',
    newsletterConsent: false,
    privacyConsent: false,
    cookieConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.privacyConsent) {
      setError('Devi accettare la Privacy Policy per registrarti.');
      return;
    }
    if (!form.cookieConsent) {
      setError('Devi accettare la Cookie Policy per registrarti.');
      return;
    }

    // Verifica maggiore eta
    const birth = new Date(form.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    if (age < 18) {
      setError('Devi essere maggiorenne (18+) per registrarti.');
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        ...form,
        privacyConsent: String(form.privacyConsent),
        cookieConsent: String(form.cookieConsent),
      });
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Errore durante la registrazione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Registrazione</h2>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Alias (nome pubblico, 3-20 caratteri)</label>
          <input type="text" name="alias" value={form.alias} onChange={handleChange} required minLength={3} maxLength={20} placeholder="Es: ProPlayer99" />
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Password (min 6 caratteri)</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} required minLength={6} />
        </div>
        <div className="form-group">
          <label>Numero di cellulare</label>
          <input type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="+39 333 1234567" />
        </div>
        <div className="form-group">
          <label>Data di nascita</label>
          <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} required />
        </div>

        <div className="checkbox-group">
          <input type="checkbox" name="newsletterConsent" checked={form.newsletterConsent} onChange={handleChange} />
          <label>Accetto di ricevere newsletter e comunicazioni promozionali</label>
        </div>
        <div className="checkbox-group">
          <input type="checkbox" name="cookieConsent" checked={form.cookieConsent} onChange={handleChange} required />
          <label>Accetto la Cookie Policy *</label>
        </div>
        <div className="checkbox-group">
          <input type="checkbox" name="privacyConsent" checked={form.privacyConsent} onChange={handleChange} required />
          <label>Accetto la Privacy Policy e il trattamento dei dati personali *</label>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Registrazione...' : 'Registrati'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: '#78909c' }}>
        Hai gia un account? <Link to="/login" style={{ color: '#4fc3f7' }}>Accedi</Link>
      </p>
    </div>
  );
}

export default Register;
