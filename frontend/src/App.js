import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { getMe } from './services/api';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import AdminUsers from './pages/AdminUsers';
import AdminTickets from './pages/AdminTickets';
import AdminEvents from './pages/AdminEvents';
import AdminAnalytics from './pages/AdminAnalytics';
import Bacheca from './pages/Bacheca';
import CookieBanner from './components/CookieBanner';
import AppFooter from './components/AppFooter';
import { useViewport } from './hooks/useViewport';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const { isMobile, isTablet } = useViewport();

  useEffect(() => {
    if (!isMobile) setNavOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.documentElement.dataset.layout = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
  }, [isMobile, isTablet]);

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

  const closeNav = () => setNavOpen(false);

  return (
    <Router>
      <div className={`app ${isMobile ? 'app--mobile' : isTablet ? 'app--tablet' : 'app--desktop'}`}>
        <CookieBanner />
        <nav className={`navbar ${isMobile ? 'navbar--mobile' : ''}`} aria-label="Navigazione principale">
          <div className="navbar-top">
            <Link
              to={user?.role === 'admin' ? '/admin/analytics' : '/'}
              className="logo"
              onClick={closeNav}
            >
              Ticket Event
            </Link>
            {isMobile && (
              <button
                type="button"
                className={`nav-burger ${navOpen ? 'nav-burger--open' : ''}`}
                aria-expanded={navOpen}
                aria-controls="main-nav-links"
                aria-label={navOpen ? 'Chiudi menu' : 'Apri menu'}
                onClick={() => setNavOpen((o) => !o)}
              >
                <span className="nav-burger__line" />
                <span className="nav-burger__line" />
                <span className="nav-burger__line" />
              </button>
            )}
          </div>
          <div
            id="main-nav-links"
            className={`nav-links ${isMobile ? 'nav-links--drawer' : ''} ${isMobile && navOpen ? 'nav-links--open' : ''}`}
          >
            {user ? (
              <>
                {user.role !== 'admin' && (
                  <>
                    <Link to="/" onClick={closeNav}>Home</Link>
                    <Link to="/bacheca" onClick={closeNav}>Bacheca</Link>
                  </>
                )}
                <Link to="/leaderboard" onClick={closeNav}>Classifica</Link>
                {user.role === 'admin' && (
                  <>
                    <Link to="/admin/analytics" onClick={closeNav}>Analytics</Link>
                    <Link to="/admin/users" onClick={closeNav}>Utenti</Link>
                    <Link to="/admin/tickets" onClick={closeNav}>Ticket</Link>
                    <Link to="/admin/events" onClick={closeNav}>Eventi</Link>
                  </>
                )}
                <Link to="/profile" className="user-info" onClick={closeNav} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="user-info__avatar" />
                  ) : (
                    <div className="user-info__avatar user-info__avatar--placeholder">
                      {user.alias?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="user-info__alias">{user.alias || user.email}</span>
                  <span className="user-info__points">({user.points} pt)</span>
                </Link>
                <button type="button" onClick={() => { handleLogout(); closeNav(); }} className="btn-logout">Esci</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeNav}>Accedi</Link>
                <Link to="/register" onClick={closeNav}>Registrati</Link>
              </>
            )}
          </div>
        </nav>

        <main className="main-content main-content--grow">
          <Routes>
            <Route path="/login" element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <Register setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/" element={user ? (user.role === 'admin' ? <Navigate to="/admin/analytics" /> : <Home user={user} />) : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <Profile user={user} setUser={setUser} /> : <Navigate to="/login" />} />
            <Route path="/bacheca" element={user ? <Bacheca /> : <Navigate to="/login" />} />
            <Route path="/leaderboard" element={user ? <Leaderboard /> : <Navigate to="/login" />} />
            <Route path="/admin/analytics" element={user?.role === 'admin' ? <AdminAnalytics /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={user?.role === 'admin' ? <AdminUsers /> : <Navigate to="/" />} />
            <Route path="/admin/tickets" element={user?.role === 'admin' ? <AdminTickets /> : <Navigate to="/" />} />
            <Route path="/admin/events" element={user?.role === 'admin' ? <AdminEvents /> : <Navigate to="/" />} />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </Router>
  );
}

export default App;
