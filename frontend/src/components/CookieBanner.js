import React, { useState } from 'react';

function CookieBanner() {
  const [accepted, setAccepted] = useState(localStorage.getItem('cookieConsent') === 'true');

  if (accepted) return null;

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setAccepted(true);
  };

  return (
    <div className="cookie-banner">
      <p>
        Questo sito utilizza cookie per migliorare la tua esperienza. Continuando a navigare,
        accetti la nostra <strong>Cookie Policy</strong> e la <strong>Privacy Policy</strong>.
      </p>
      <button className="btn-primary" style={{ width: 'auto' }} onClick={handleAccept}>
        Accetta
      </button>
    </div>
  );
}

export default CookieBanner;
