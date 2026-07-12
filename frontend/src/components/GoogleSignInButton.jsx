import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

let gsiScriptPromise = null;

function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

export default function GoogleSignInButton({ onSuccess, onError }) {
  const buttonRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api.get('/auth/google/config')
      .then(({ data }) => setClientId(data.data.clientId))
      .catch(() => setClientId(null))
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;
    let cancelled = false;

    loadGsiScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              const { data } = await api.post('/auth/google', { credential: response.credential });
              onSuccess?.(data.data);
            } catch (err) {
              onError?.(err.response?.data?.message || 'Google sign-in failed');
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: buttonRef.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      })
      .catch(() => onError?.('Could not load Google Sign-In. Check your internet connection.'));

    return () => { cancelled = true; };
  }, [clientId, onSuccess, onError]);

  if (checked && !clientId) return null;

  return <div ref={buttonRef} className="flex w-full justify-center" />;
}
