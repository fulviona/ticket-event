import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { login } from '../services/api';

function Login({ setUser }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante il login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Accedi</h2>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} required />
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Accesso...' : 'Accedi'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: '#78909c' }}>
        Non hai un account? <Link to="/register" style={{ color: '#4fc3f7' }}>Registrati</Link>
      </p>
    </div>
  );
}

export default Login;
