import { useState, useEffect } from 'react';

const MOBILE_MAX = 768;
const TABLET_MAX = 1024;

function getSnapshot() {
  if (typeof window === 'undefined') {
    return { width: 1200, isMobile: false, isTablet: false, isDesktop: true };
  }
  const width = window.innerWidth;
  return {
    width,
    isMobile: width <= MOBILE_MAX,
    isTablet: width > MOBILE_MAX && width <= TABLET_MAX,
    isDesktop: width > TABLET_MAX,
  };
}

/**
 * Aggiorna su resize/orientamento: mobile (≤768), tablet (769–1024), desktop (>1024).
 */
export function useViewport() {
  const [state, setState] = useState(getSnapshot);

  useEffect(() => {
    const onChange = () => setState(getSnapshot());
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  return state;
}
