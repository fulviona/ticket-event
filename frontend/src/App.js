import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { getMe } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import AdminUsers from './pages/AdminUsers';
import AdminEvents from './pages/AdminEvents';
import CookieBanner from './components/CookieBanner';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) return <div className="loading">Caricamento...</div>;

  return (
    <Router>
      <div className="app">
        <CookieBanner />
        <nav className="navbar">
          <Link to="/" className="logo">Ticket Event</Link>
          <div className="nav-links">
            {user ? (
              <>
                <Link to="/">Home</Link>
                <Link to="/leaderboard">Classifica</Link>
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/users">Utenti</Link>
                    <Link to="/admin/events">Eventi</Link>
                  </>
                )}
                <span className="user-info">{user.email} ({user.points} pt)</span>
                <button onClick={handleLogout} className="btn-logout">Esci</button>
              </>
            ) : (
              <>
                <Link to="/login">Accedi</Link>
                <Link to="/register">Registrati</Link>
              </>
            )}
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Home user={user} /> : <Navigate to="/login" />} />
            <Route path="/leaderboard" element={user ? <Leaderboard /> : <Navigate to="/login" />} />
            <Route path="/admin/users" element={user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/" />} />
            <Route path="/admin/events" element={user?.role === 'admin' ? <AdminEvents /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
