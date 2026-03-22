import React, { useState } from 'react';
import { ADM_VERIFICA_QUOTA_FISSA_URL } from '../constants/adm';

/**
 * Link al portale ADM + copia ID ticket.
 * L’esito (vincente/perdente/rimborsabile) è comunicato solo dopo verifica sul sito ADM (captcha).
 */
function AdmTicketVerify({ ticketId }) {
  const [copied, setCopied] = useState(false);
  const id = ticketId != null ? String(ticketId).trim() : '';
  if (!id) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = id;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="adm-verify-block">
      <div className="adm-verify-actions">
        <a
          href={ADM_VERIFICA_QUOTA_FISSA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="adm-verify-link"
        >
          Verifica su ADM (ufficiale)
        </a>
        <button type="button" className="btn-small adm-verify-copy" onClick={handleCopy}>
          {copied ? 'Copiato' : 'Copia ID'}
        </button>
      </div>
      <p className="adm-verify-hint">
        Sul sito ADM inserisci il <strong>codice della ricevuta</strong> (spesso 20 cifre) o il codice indicato come
        AAMS/ADM. L&apos;ID mostrato qui è quello estratto dal ticket: se coincide, incollalo nel modulo; altrimenti usa
        il codice stampato sulla ricevuta. L&apos;esito definitivo (es. PAGABILE, PERDENTE) è solo sul portale ADM.
      </p>
    </div>
  );
}

export default AdmTicketVerify;
