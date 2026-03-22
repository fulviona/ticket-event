import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FRONTEND_VERSION } from '../version';

function AppFooter() {
  const [backendVersion, setBackendVersion] = useState(null);

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setBackendVersion(res.data.backendVersion))
      .catch(() => setBackendVersion(null));
  }, []);

  return (
    <footer className="app-footer" role="contentinfo">
      <span className="app-footer-label">Frontend v{FRONTEND_VERSION}</span>
      <span className="app-footer-sep" aria-hidden="true">
        ·
      </span>
      <span className="app-footer-label">
        Backend v{backendVersion == null ? '…' : backendVersion || '—'}
      </span>
    </footer>
  );
}

export default AppFooter;
